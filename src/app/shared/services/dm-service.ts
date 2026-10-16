import { Injector, Service, computed, effect, inject, signal } from '@angular/core';
import { FIREBASE_AUTH, FIREBASE_FIRESTORE } from '../../app.config';
import { Dm } from '../interfaces/dm';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { Message } from '../interfaces/message';
import { ThreadMessage } from '../interfaces/thread';
import { UserModel } from '../model/user.model';
import { UserService } from './users';
import { AuthService } from './auth';
import { NewMessageService } from './new-message-service';
import { ChannelService } from './channel-service';
import {
  addReaction,
  addThreadReply,
  deleteGuestContent,
  editOwnMessageText,
  removeReaction,
  subscribeToMessage,
  subscribeToMessages,
  subscribeToThreadReplies,
} from '../utilities/conversation-firestore.utils';

@Service()
/** Provides Firestore operations and reactive direct-message data. */
export class DmService {
  private db = inject(FIREBASE_FIRESTORE);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private newMessageService = inject(NewMessageService);
  private auth = inject(FIREBASE_AUTH);
  private injector = inject(Injector);

  /** The direct-message conversations available to the application. */
  dms = signal<Dm[]>([]);
  /** Identifier of the currently active direct-message conversation, or `undefined` if none is selected. */
  activeDmId = signal<string | undefined>(undefined);

  /** Sets the active direct-message conversation.
   *
   * @param dmId The ID of the direct-message conversation to select.
   */
  selectDm(dmId: string): void {
    this.activeDmId.set(dmId);
    this.injector.get(ChannelService).activeChannelId.set(undefined);
    this.newMessageService.close();
  }

  /** Ensures a self-DM conversation exists for the given user, creating it if necessary.
   *
   * @param userId The UID of the user to create a self-DM for.
   */
  private async ensureSelfDm(userId: string): Promise<void> {
    const selfDmRef = doc(this.db, 'dms', `self_${userId}`);
    const snapshot = await getDoc(selfDmRef);
    if (!snapshot.exists()) {
      await setDoc(selfDmRef, {
        memberIds: [userId],
        lastMessageAt: serverTimestamp(),
      });
    }
  }

  constructor() {
    effect((onCleanup) => this.subscribeToOwnDms(onCleanup));
  }

  /** Ensures the self-DM exists, then subscribes to every DM the user is a member of. */
  private subscribeToOwnDms(onCleanup: (fn: () => void) => void): void {
    const userId = this.authService.currentUserId();
    if (!userId) {
      this.dms.set([]);
      this.activeDmId.set(undefined);
      return;
    }
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    this.ensureSelfDm(userId).then(() => {
      if (!cancelled) unsubscribe = this.listenToOwnDms(userId);
    });
    onCleanup(() => { cancelled = true; unsubscribe?.(); });
  }

  private listenToOwnDms(userId: string): () => void {
    const q = query(collection(this.db, 'dms'), where('memberIds', 'array-contains', userId));
    return onSnapshot(
      q,
      (snapshot) => this.dms.set(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Dm)),
      (err) => console.error('[DM-Listener]', err.code, err.message),
    );
  }

  /** Subscribes to all messages in a direct-message conversation.
   *
   * @param dmId The ID of the direct-message conversation.
   * @returns A signal containing the messages and a function that removes the listener.
   */
  getMessages(
    dmId: string,
    onMessages?: (messages: Message[]) => void,
  ): { messages: ReturnType<typeof signal<Message[]>>; unsubscribe: () => void } {
    return subscribeToMessages(this.db, 'dms', dmId, onMessages);
  }

  /** Subscribes to a single message in a direct-message conversation.
   *
   * @param dmId The ID of the direct-message conversation.
   * @param messageId The ID of the message to observe.
   * @returns A signal containing the message and a function that removes the listener.
   */
  getMessage(
    dmId: string,
    messageId: string,
    onMessage?: (message: Message | null) => void,
  ): { message: ReturnType<typeof signal<Message | null>>; unsubscribe: () => void } {
    return subscribeToMessage(this.db, 'dms', dmId, messageId, onMessage);
  }

  /** Subscribes to all thread replies for a direct message.
   *
   * @param dmId The ID of the direct-message conversation.
   * @param messageId The ID of the message whose thread should be observed.
   * @returns A signal containing the thread replies and a function that removes the listener.
   */
  getThreads(
    dmId: string,
    messageId: string,
    onThreadMessages?: (threadMessages: ThreadMessage[]) => void,
  ): { threadMessage: ReturnType<typeof signal<ThreadMessage[]>>; unsubscribe: () => void } {
    return subscribeToThreadReplies(this.db, 'dms', dmId, messageId, onThreadMessages);
  }

  /** Creates a direct-message conversation for the specified users.
   *
   * @param memberIds The user IDs participating in the conversation.
   */
  async addDm(memberIds: string[]): Promise<string> {
    const docRef = await addDoc(collection(this.db, 'dms'), {
      memberIds: memberIds,
      lastMessageAt: serverTimestamp(),
    });
    return docRef.id;
  }

  /** Adds a message to a direct-message conversation and updates its timestamp.
   *
   * @param dmId The ID of the direct-message conversation.
   * @param messageText The text content of the message.
   * @param senderId The ID of the user sending the message.
   */
  async addMessageToDm(dmId: string, messageText: string, senderId: string): Promise<void> {
    await addDoc(collection(this.db, 'dms', dmId, 'messages'), {
      createdAt: serverTimestamp(),
      senderId: senderId,
      text: messageText,
    });

    const dmRef = doc(this.db, 'dms', dmId);
    await updateDoc(dmRef, {
      lastMessageAt: serverTimestamp(),
    });
  }

  /** Adds a reply to a direct message and increments its thread count.
   *
   * @param dmId The ID of the direct-message conversation.
   * @param messageId The ID of the message receiving the reply.
   * @param threadMessage The text content of the reply.
   * @param senderId The ID of the user sending the reply.
   */
  async addDmThread(
    dmId: string,
    messageId: string,
    threadMessage: string,
    senderId: string,
  ): Promise<void> {
    await addThreadReply(this.db, 'dms', dmId, messageId, threadMessage, senderId);
  }

  /** Adds a user's reaction to a direct message.
   *
   * @param dmId The ID of the direct-message conversation.
   * @param messageId The ID of the message to react to.
   * @param reaction The reaction identifier.
   * @param userId The ID of the reacting user.
   */
  async addReactionToDmMessage(
    dmId: string,
    messageId: string,
    reaction: string,
    userId: string,
  ): Promise<void> {
    const messageRef = doc(this.db, 'dms', dmId, 'messages', messageId);
    await addReaction(messageRef, reaction, userId);
  }

  /** Adds a user's reaction to a direct-message thread reply.
   *
   * @param dmId The ID of the direct-message conversation.
   * @param messageId The ID of the parent message.
   * @param reaction The reaction identifier.
   * @param userId The ID of the reacting user.
   * @param threadId The ID of the thread reply.
   */
  async addReactionToDmThreadMessage(
    dmId: string,
    messageId: string,
    reaction: string,
    userId: string,
    threadId: string,
  ): Promise<void> {
    const messageRef = doc(this.db, 'dms', dmId, 'messages', messageId, 'thread', threadId);
    await addReaction(messageRef, reaction, userId);
  }

  /** Removes a user's reaction from a direct message.
   *
   * @param dmId The ID of the direct-message conversation.
   * @param messageId The ID of the message to update.
   * @param reaction The reaction identifier.
   * @param userId The ID of the user whose reaction should be removed.
   */
  async removeReactionFromDmMessage(
    dmId: string,
    messageId: string,
    reaction: string,
    userId: string,
  ): Promise<void> {
    const messageRef = doc(this.db, 'dms', dmId, 'messages', messageId);
    await removeReaction(messageRef, reaction, userId);
  }

  /** Removes a user's reaction from a direct-message thread reply.
   *
   * @param dmId The ID of the direct-message conversation.
   * @param messageId The ID of the parent message.
   * @param reaction The reaction identifier.
   * @param userId The ID of the user whose reaction should be removed.
   * @param threadId The ID of the thread reply.
   */
  async removeReactionFromDmThreadMessage(
    dmId: string,
    messageId: string,
    reaction: string,
    userId: string,
    threadId: string,
  ): Promise<void> {
    const messageRef = doc(this.db, 'dms', dmId, 'messages', messageId, 'thread', threadId);
    await removeReaction(messageRef, reaction, userId);
  }

  /** All workspace users eligible for direct messaging, each paired with their existing DM
   * conversation (if any) and whether they are the signed-in user. Excludes users named
   * "Guest", except the signed-in user themself. Sorted alphabetically by name.
   */
  dmPartners = computed(() => {
    const currentUserId = this.authService.currentUserId();
    const dms = this.dms();
    return this.userService
      .users()
      .filter((user) => user.name !== 'Guest' || user.uid === currentUserId)
      .map((user) => this.toDmPartner(user, dms, currentUserId))
      .sort((a, b) => a.user.name.localeCompare(b.user.name, 'de'));
  });

  /** Pairs a user with their existing DM (if any) and whether they are the signed-in user. */
  private toDmPartner(user: UserModel, dms: Dm[], currentUserId: string | undefined) {
    const isSelf = user.uid === currentUserId;
    const existingDm = dms.find((dm) =>
      isSelf
        ? dm.memberIds.length === 1 && dm.memberIds[0] === currentUserId
        : dm.memberIds.includes(currentUserId!) && dm.memberIds.includes(user.uid),
    );
    return { user, isSelf, dm: existingDm ?? null };
  }

  /** Updates the text of a direct message, if the signed-in user is its sender.
   * Does nothing if no user is logged in, or if the user is not the sender.
   *
   * @param dmId The ID of the direct-message conversation.
   * @param messageId The ID of the message to edit.
   * @param text The new message text.
   */
  async editDmMessage(dmId: string, messageId: string, text: string): Promise<void> {
    const messageRef = doc(this.db, 'dms', dmId, 'messages', messageId);
    await editOwnMessageText(this.auth, messageRef, text);
  }

  /** Updates the text of a direct-message thread reply, if the signed-in user is its sender.
   *
   * @param dmId The ID of the direct-message conversation.
   * @param messageId The ID of the parent message.
   * @param threadId The ID of the thread reply to edit.
   * @param text The new reply text.
   */
  async editThreadMessage(
    dmId: string,
    messageId: string,
    threadId: string,
    text: string,
  ): Promise<void> {
    const threadRef = doc(this.db, 'dms', dmId, 'messages', messageId, 'thread', threadId);
    await editOwnMessageText(this.auth, threadRef, text);
  }

  /** Opens the direct-message conversation with the given user, creating a self-DM
   * or a new conversation first if none exists yet.
   *
   * @param partnerId The UID of the user to open a direct message with.
   */
  async openDmWith(partnerId: string): Promise<void> {
    const currentUserId = this.authService.currentUserId();
    if (!currentUserId) return;

    if (partnerId === currentUserId) {
      this.selectDm(`self_${currentUserId}`);
      return;
    }

    const existingDm = this.dms().find(
      (dm) => dm.memberIds.includes(currentUserId) && dm.memberIds.includes(partnerId),
    );

    const dmId = existingDm?.id ?? (await this.addDm([currentUserId, partnerId]));
    this.selectDm(dmId);
  }

  /** Deletes every message and thread reply authored by the given user, across all
   * DMs they're part of; strips their reactions from everyone else's messages/replies;
   * and decrements each parent message's threadCount by the number of its thread
   * replies that were deleted.
   *
   * @param senderId The UID of the departing guest.
   */
  async deleteGuestMessages(senderId: string): Promise<void> {
    await deleteGuestContent(this.db, 'dms', senderId, { filterByMembership: true });
  }
}
