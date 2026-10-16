import { computed, inject, Service, signal } from '@angular/core';
import { Channel } from '../interfaces/channel';
import { UserModel } from '../model/user.model';
import { ChannelService } from './channel-service';
import { UserService } from './users';
import { FIREBASE_FIRESTORE } from '../../app.config';
import { Message } from '../interfaces/message';
import { collection, getDocs, QueryDocumentSnapshot } from 'firebase/firestore';
import { DmService } from './dm-service';
import { AuthService } from './auth';

/** Minimum number of characters required to run a search. */
const MIN_QUERY_LENGTH = 3;

/** Delay between query changes and starting a search. */
const DEBOUNCE_MS = 300;

/** Search categories supported by the global search. */
export type SearchMode = 'all' | 'users' | 'channels';

/** Groups the channel, user, and message matches returned by a search. */
export interface SearchResults {
  /** Channels whose names match the query. */
  channels: Channel[];
  /** Users whose names match the query. */
  users: UserModel[];
  /** Messages and thread replies matching the query. */
  messages: MessageSearchResult[];
}

/** Empty search result set used before a search and when a query is cleared. */
const EMPTY_RESULTS: SearchResults = { channels: [], users: [], messages: [] };

/** A message match with the conversation context needed to navigate to it. */
export interface MessageSearchResult {
  /** The matched message. */
  message: Message;
  /** Display name of the message sender. */
  senderName: string;
  /** Whether the result is a channel message, DM, or thread reply. */
  source: 'channel' | 'dm' | 'channel-thread' | 'dm-thread';
  /** ID of the channel or direct-message conversation containing the message. */
  conversationId: string;
  /** Display name of the channel or DM partner. */
  conversationName: string;
  /** ID of the parent message when the result is a thread reply. */
  parentMessageId?: string;
}

/** Searches users, channels, messages, and thread replies. */
@Service()
export class SearchService {
  /** Current raw search query, including any category prefix. */
  query = signal('');

  /** Results for the current search query. */
  results = signal<SearchResults>(EMPTY_RESULTS);

  /** Provides the currently loaded channels. */
  private channelService = inject(ChannelService);

  /** Provides workspace users and sender display names. */
  private userService = inject(UserService);

  /** Provides Firestore access for message and thread searches. */
  private firestore = inject(FIREBASE_FIRESTORE);

  /** Provides direct-message conversations. */
  private dmService = inject(DmService);

  /** Provides the current user's ID for determining DM partners. */
  private authService = inject(AuthService);

  /** Whether the parsed query contains enough characters to run a search. */
  isQueryValid = computed(() => this.parseQuery(this.query()).term.length >= MIN_QUERY_LENGTH);

  /** Pending debounce timer for the current query. */
  private debounceHandle: ReturnType<typeof setTimeout> | undefined;

  /**
   * Updates the query and schedules a search when it is long enough.
   *
   * @param rawQuery The full query entered by the user.
   */
  setQuery(rawQuery: string): void {
    this.query.set(rawQuery);
    clearTimeout(this.debounceHandle);

    if (!this.isQueryValid()) {
      this.results.set(EMPTY_RESULTS);
      return;
    }

    this.debounceHandle = setTimeout(() => void this.runSearch(rawQuery), DEBOUNCE_MS);
  }

  /** Cancels any pending search and clears the query and results. */
  clear(): void {
    clearTimeout(this.debounceHandle);
    this.query.set('');
    this.results.set(EMPTY_RESULTS);
  }

  /**
   * Parses an optional category prefix from a raw search query.
   *
   * @param rawQuery The full query entered by the user.
   * @returns The selected search mode and the trimmed search term.
   */
  private parseQuery(rawQuery: string): { mode: SearchMode; term: string } {
    const trimmed = rawQuery.trim();
    if (trimmed.startsWith('@')) return { mode: 'users', term: trimmed.slice(1).trim() };
    if (trimmed.startsWith('#')) return { mode: 'channels', term: trimmed.slice(1).trim() };
    return { mode: 'all', term: trimmed };
  }

  /** Runs a search for the given raw query and stores its results. */
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

  /** Finds loaded channels whose names contain the search term. */
  private searchChannels(needle: string): Channel[] {
    return this.channelService.channels().filter((c) => c.name.toLowerCase().includes(needle));
  }

  /** Finds loaded users whose names contain the search term. */
  private searchUsers(needle: string): UserModel[] {
    return this.userService.users().filter((u) => u.name.toLowerCase().includes(needle));
  }

  /** Searches messages across all loaded channels and direct-message conversations. */
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

  /** Searches thread replies across all loaded channels and direct-message conversations. */
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

  /**
   * Converts a Firestore message document into a result with conversation context.
   *
   * @param doc The Firestore document containing the message.
   * @param source The conversation or thread type containing the message.
   * @param conversationId The ID of the containing channel or DM.
   * @param conversationName The display name of the channel or DM partner.
   * @param parentMessageId The parent message ID when converting a thread reply.
   * @returns The message search result with sender and conversation details.
   */
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
