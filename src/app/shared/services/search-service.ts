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
    this.results.set(await this.collectResults(mode, term.toLowerCase()));
  }

  /** Runs the search for the given mode and returns the resulting channels/users/messages. */
  private async collectResults(mode: SearchMode, needle: string): Promise<SearchResults> {
    if (mode === 'users') return { ...EMPTY_RESULTS, users: this.searchUsers(needle) };
    if (mode === 'channels') return { ...EMPTY_RESULTS, channels: this.searchChannels(needle) };

    const [messages, threadMessages] = await Promise.all([
      this.searchMessages(needle),
      this.searchThreads(needle),
    ]);
    return { channels: this.searchChannels(needle), users: [], messages: [...messages, ...threadMessages] };
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
      .map((channel) => this.fetchConversationMessages('channels', channel.id, 'channel', channel.name));
    const dmSearches = this.dmService
      .dms()
      .map((dm) =>
        this.fetchConversationMessages('dms', dm.id, 'dm', this.getDmPartnerName(dm.id, currentUserId)),
      );
    const results = await Promise.all([...channelSearches, ...dmSearches]);
    return results.flat().filter(({ message }) => message.text.toLowerCase().includes(needle));
  }

  /** Fetches and converts all messages of a single channel or DM conversation. */
  private async fetchConversationMessages(
    root: 'channels' | 'dms',
    conversationId: string,
    source: 'channel' | 'dm',
    conversationName: string,
  ): Promise<MessageSearchResult[]> {
    const snapshot = await getDocs(collection(this.firestore, root, conversationId, 'messages'));
    return snapshot.docs.map((doc) => this.toMessageResult(doc, source, conversationId, conversationName));
  }

  private async searchThreads(needle: string): Promise<MessageSearchResult[]> {
    const currentUserId = this.authService.currentUserId();
    const channelThreadSearches = this.channelService.channels().map((channel) =>
      this.fetchConversationThreadResults('channels', channel.id, 'channel-thread', channel.name),
    );
    const dmThreadSearches = this.dmService.dms().map((dm) =>
      this.fetchConversationThreadResults('dms', dm.id, 'dm-thread', this.getDmPartnerName(dm.id, currentUserId)),
    );
    const results = await Promise.all([...channelThreadSearches, ...dmThreadSearches]);
    return results.flat().filter(({ message }) => message.text.toLowerCase().includes(needle));
  }

  /** Fetches thread replies of every message with a thread in one channel or DM conversation. */
  private async fetchConversationThreadResults(
    root: 'channels' | 'dms',
    conversationId: string,
    source: 'channel-thread' | 'dm-thread',
    conversationName: string,
  ): Promise<MessageSearchResult[]> {
    const messagesSnapshot = await getDocs(collection(this.firestore, root, conversationId, 'messages'));
    const threadFetches = messagesSnapshot.docs
      .filter((messageDoc) => (messageDoc.data() as Message).threadCount)
      .map((messageDoc) =>
        this.fetchThreadReplies(root, conversationId, messageDoc.id, source, conversationName),
      );
    return (await Promise.all(threadFetches)).flat();
  }

  /** Fetches and converts the thread replies of a single message. */
  private async fetchThreadReplies(
    root: 'channels' | 'dms',
    conversationId: string,
    messageId: string,
    source: 'channel-thread' | 'dm-thread',
    conversationName: string,
  ): Promise<MessageSearchResult[]> {
    const threadSnapshot = await getDocs(
      collection(this.firestore, root, conversationId, 'messages', messageId, 'thread'),
    );
    return threadSnapshot.docs.map((doc) =>
      this.toMessageResult(doc, source, conversationId, conversationName, messageId),
    );
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
