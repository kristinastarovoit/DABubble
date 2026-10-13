import { computed, inject, Service, signal } from '@angular/core';
import { Channel } from '../interfaces/channel';
import { UserModel } from '../model/user.model';
import { ChannelService } from './channel-service';
import { UserService } from './users';
import { FIREBASE_FIRESTORE } from '../../app.config';
import { Message } from '../interfaces/message';
import { collectionGroup, getDocs } from 'firebase/firestore';

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
  channelId: string;
  channelName: string;
}

@Service()
export class SearchService {
  query = signal('');
  results = signal<SearchResults>(EMPTY_RESULTS);

  private channelService = inject(ChannelService);
  private userService = inject(UserService);
  private firestore = inject(FIREBASE_FIRESTORE);

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

    return snapshot.docs
      .map((doc) => {
        const message = { id: doc.id, ...(doc.data() as Message) };
        const channelId = doc.ref.parent.parent?.id ?? '';
        return { message, channelId, channelName: channelNameById.get(channelId) ?? 'Unknown' };
      })
      .filter(({ message }) => message.text.toLowerCase().includes(needle));
  }
}
