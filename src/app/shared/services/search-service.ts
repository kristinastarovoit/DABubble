import { computed, inject, Service, signal } from '@angular/core';
import { Channel } from '../interfaces/channel';
import { UserModel } from '../model/user.model';
import { ChannelService } from './channel-service';
import { UserService } from './users';
import { FIREBASE_FIRESTORE } from '../../app.config';
import { Message } from '../interfaces/message';
import { collectionGroup, getDocs } from 'firebase/firestore';
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
  source: 'channel' | 'dm';
  conversationId: string;
  conversationName: string;
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
      messages = await this.searchMessages(needle);
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
    const snapshot = await getDocs(collectionGroup(this.firestore, 'messages'));
    const channelNameById = new Map(this.channelService.channels().map((c) => [c.id, c.name]));
    const currentUserId = this.authService.currentUserId();

    return snapshot.docs
      .map((doc) => {
        const message = { id: doc.id, ...(doc.data() as Message) };
        const conversationId = doc.ref.parent.parent?.id ?? '';
        const parentCollection = doc.ref.parent.parent?.parent.id;
        const source: 'channel' | 'dm' = parentCollection === 'dms' ? 'dm' : 'channel';

        const conversationName =
          source === 'channel'
            ? (channelNameById.get(conversationId) ?? 'Unknown')
            : this.getDmPartnerName(conversationId, currentUserId);

        return {
          message,
          conversationId,
          conversationName,
          source,
          senderName: this.userService.getUserName(message.senderId),
        };
      })
      .filter(({ message }) => message.text.toLowerCase().includes(needle));
  }

  /** Resolves a display name for the "other side" of a DM conversation. */
  private getDmPartnerName(dmId: string, currentUserId: string | undefined): string {
    const dm = this.dmService.dms().find((d) => d.id === dmId);
    if (!dm) return 'Unknown';
    const partnerId = dm.memberIds.find((id) => id !== currentUserId) ?? dm.memberIds[0];
    return this.userService.getUserName(partnerId);
  }
}
