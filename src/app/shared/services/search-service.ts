import { computed, inject, Service, signal } from '@angular/core';
import { Channel } from '../interfaces/channel';
import { UserModel } from '../model/user.model';
import { ChannelService } from './channel-service';
import { UserService } from './users';
import { FIREBASE_FIRESTORE } from '../../app.config';
import { Message } from '../interfaces/message';
import { collection, collectionGroup, getDocs, QueryDocumentSnapshot } from 'firebase/firestore';
import { DmService } from './dm-service';
import { AuthService } from './auth';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

export type SearchMode = 'all' | 'users' | 'channels';

export interface SearchResults {
  channels: Channel[];
  users: UserModel[];
  messages: MessageSearchResult[];
}

const EMPTY_RESULTS: SearchResults = { channels: [], users: [], messages: [] };

export interface MessageSearchResult {
  message: Message;
  senderName: string;
  source: 'channel' | 'dm' | 'channel-thread' | 'dm-thread';
  conversationId: string;
  conversationName: string;
  parentMessageId?: string;
}

@Service()
export class SearchService {
  query = signal('');
  results = signal<SearchResults>(EMPTY_RESULTS);

  private channelService = inject(ChannelService);
  private userService = inject(UserService);
  private firestore = inject(FIREBASE_FIRESTORE);
  private dmService = inject(DmService);
  private authService = inject(AuthService);

  isQueryValid = computed(() => this.parseQuery(this.query()).term.length >= MIN_QUERY_LENGTH);

  private debounceHandle: ReturnType<typeof setTimeout> | undefined;

  setQuery(rawQuery: string): void {
    this.query.set(rawQuery);
    clearTimeout(this.debounceHandle);

    if (!this.isQueryValid()) {
      this.results.set(EMPTY_RESULTS);
      return;
    }

    this.debounceHandle = setTimeout(() => void this.runSearch(rawQuery), DEBOUNCE_MS);
  }

  clear(): void {
    clearTimeout(this.debounceHandle);
    this.query.set('');
    this.results.set(EMPTY_RESULTS);
  }

  private parseQuery(rawQuery: string): { mode: SearchMode; term: string } {
    const trimmed = rawQuery.trim();
    if (trimmed.startsWith('@')) return { mode: 'users', term: trimmed.slice(1).trim() };
    if (trimmed.startsWith('#')) return { mode: 'channels', term: trimmed.slice(1).trim() };
    return { mode: 'all', term: trimmed };
  }

  private async runSearch(rawQuery: string): Promise<void> {
    const { mode, term } = this.parseQuery(rawQuery);
    const needle = term.toLowerCase();

    let channels: Channel[] = [];
    let users: UserModel[] = [];
    let messages: MessageSearchResult[] = [];

    if (mode === 'users') {
      users = this.searchUsers(needle);
    } else if (mode === 'channels') {
      channels = this.searchChannels(needle);
    } else {
      channels = this.searchChannels(needle);
      const [channelAndDmMessages, threadMessages] = await Promise.all([
        this.searchMessages(needle),
        this.searchThreads(needle),
      ]);
      messages = [...channelAndDmMessages, ...threadMessages];
    }

    this.results.set({ channels, users, messages });
  }

  private searchChannels(needle: string): Channel[] {
    return this.channelService.channels().filter((c) => c.name.toLowerCase().includes(needle));
  }

  private searchUsers(needle: string): UserModel[] {
    return this.userService.users().filter((u) => u.name.toLowerCase().includes(needle));
  }

  private async searchMessages(needle: string): Promise<MessageSearchResult[]> {
    const currentUserId = this.authService.currentUserId();

    const channelSearches = this.channelService
      .channels()
      .map((channel) =>
        getDocs(collection(this.firestore, 'channels', channel.id, 'messages')).then((snapshot) =>
          snapshot.docs.map((doc) =>
            this.toMessageResult(doc, 'channel', channel.id, channel.name),
          ),
        ),
      );

    const dmSearches = this.dmService
      .dms()
      .map((dm) =>
        getDocs(collection(this.firestore, 'dms', dm.id, 'messages')).then((snapshot) =>
          snapshot.docs.map((doc) =>
            this.toMessageResult(doc, 'dm', dm.id, this.getDmPartnerName(dm.id, currentUserId)),
          ),
        ),
      );

    const results = await Promise.all([...channelSearches, ...dmSearches]);

    return results.flat().filter(({ message }) => message.text.toLowerCase().includes(needle));
  }

  private async searchThreads(needle: string): Promise<MessageSearchResult[]> {
    const currentUserId = this.authService.currentUserId();

    const channelThreadSearches = this.channelService.channels().map(async (channel) => {
      const messagesSnapshot = await getDocs(
        collection(this.firestore, 'channels', channel.id, 'messages'),
      );
      const threadFetches = messagesSnapshot.docs
        .filter((messageDoc) => (messageDoc.data() as Message).threadCount)
        .map((messageDoc) =>
          getDocs(
            collection(this.firestore, 'channels', channel.id, 'messages', messageDoc.id, 'thread'),
          ).then((threadSnapshot) =>
            threadSnapshot.docs.map((doc) =>
              this.toMessageResult(doc, 'channel-thread', channel.id, channel.name, messageDoc.id),
            ),
          ),
        );
      return (await Promise.all(threadFetches)).flat();
    });

    const dmThreadSearches = this.dmService.dms().map(async (dm) => {
      const messagesSnapshot = await getDocs(collection(this.firestore, 'dms', dm.id, 'messages'));
      const threadFetches = messagesSnapshot.docs
        .filter((messageDoc) => (messageDoc.data() as Message).threadCount)
        .map((messageDoc) =>
          getDocs(
            collection(this.firestore, 'dms', dm.id, 'messages', messageDoc.id, 'thread'),
          ).then((threadSnapshot) =>
            threadSnapshot.docs.map((doc) =>
              this.toMessageResult(
                doc,
                'dm-thread',
                dm.id,
                this.getDmPartnerName(dm.id, currentUserId),
                messageDoc.id,
              ),
            ),
          ),
        );
      return (await Promise.all(threadFetches)).flat();
    });

    const results = await Promise.all([...channelThreadSearches, ...dmThreadSearches]);
    return results.flat().filter(({ message }) => message.text.toLowerCase().includes(needle));
  }

  private toMessageResult(
    doc: QueryDocumentSnapshot,
    source: 'channel' | 'dm' | 'channel-thread' | 'dm-thread',
    conversationId: string,
    conversationName: string,
    parentMessageId?: string,
  ): MessageSearchResult {
    const message = { id: doc.id, ...(doc.data() as Message) };
    return {
      message,
      conversationId,
      conversationName,
      source,
      parentMessageId,
      senderName: this.userService.getUserName(message.senderId),
    };
  }

  /** Resolves a display name for the "other side" of a DM conversation. */
  private getDmPartnerName(dmId: string, currentUserId: string | undefined): string {
    const dm = this.dmService.dms().find((d) => d.id === dmId);
    if (!dm) return 'Unknown';
    const partnerId = dm.memberIds.find((id) => id !== currentUserId) ?? dm.memberIds[0];
    return this.userService.getUserName(partnerId);
  }
}
