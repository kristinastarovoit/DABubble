import { Injector, Service, inject, signal } from '@angular/core';
import { FIREBASE_FIRESTORE, FIREBASE_AUTH } from '../../app.config';
import { Channel } from '../interfaces/channel';
import { DocumentReference, DocumentData, QuerySnapshot, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { Message } from '../interfaces/message';
import { ThreadMessage } from '../interfaces/thread';
import { onAuthStateChanged, User } from 'firebase/auth';
import { NewMessageService } from './new-message-service';
import { DmService } from './dm-service';
import { addReaction, addThreadReply, deleteGuestContent, editOwnMessageText, pruneGuestFromChannels, removeReaction, subscribeToMessage, subscribeToMessages, subscribeToThreadReplies } from '../utilities/conversation-firestore.utils';

@Service()
/** Provides Firestore operations and reactive channel data for the current user. */
export class ChannelService {
  private db = inject(FIREBASE_FIRESTORE);
  private auth = inject(FIREBASE_AUTH);
  private newMessageService = inject(NewMessageService);
  private injector = inject(Injector);

  /** The channels in which the currently authenticated user is a member. */
  channels = signal<Channel[]>([]);
  activeChannelId = signal<string | undefined>(undefined);

  constructor() {
    onAuthStateChanged(this.auth, (user) => this.syncChannelsForAuthUser(user));
  }

  selectChannel(channelId: string): void {
    this.activeChannelId.set(channelId);
    this.injector.get(DmService).activeDmId.set(undefined);
    this.newMessageService.close();
  }

  private unsubscribeChannels?: () => void;
  private initialChannelSelected = false;

  /** Builds the document reference of a thread reply within a channel message. */
  private threadMessageRef(
    channelId: string,
    messageId: string,
    threadId: string,
  ): DocumentReference {
    return doc(this.db, 'channels', channelId, 'messages', messageId, 'thread', threadId);
  }

  /** Subscribes to all channels while signed in, and clears them when signed out. */
  private syncChannelsForAuthUser(user: User | null): void {
    this.unsubscribeChannels?.();
    this.unsubscribeChannels = undefined;
    if (!user) {
      this.channels.set([]);
      this.activeChannelId.set(undefined);
      this.initialChannelSelected = false;
      return;
    }
    this.unsubscribeChannels = onSnapshot(
      collection(this.db, 'channels'),
      (snapshot) => this.applyChannelsSnapshot(snapshot),
      (err) => console.error('[Channels-Listener]', err.code, err.message),
    );
  }

  /** Stores the latest channels and auto-selects a default one on first load. */
  private applyChannelsSnapshot(snapshot: QuerySnapshot<DocumentData>): void {
    const channels = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Channel);
    this.channels.set(channels);
    if (this.initialChannelSelected || channels.length === 0) return;
    const general = channels.find((c) => c.name === 'Code Review') ?? channels[0];
    this.selectChannel(general.id);
    this.initialChannelSelected = true;
  }

  /** Checks whether a channel with the given name already exists.
   *
   * @param name The channel name to check.
   * @returns Whether a channel with this name already exists.
   */
  async channelNameExists(name: string): Promise<boolean> {
    const channelsRef = collection(this.db, 'channels');
    const q = query(channelsRef, where('name', '==', name));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  /** Creates a channel and adds the current user as its first member.
   * Does nothing if no user is logged in, or if a channel with the
   * same name already exists.
   *
   * @param name The display name of the new channel.
   * @param description The description of the new channel.
   * @param memberIds Additional member IDs to add alongside the creator.
   * @returns The ID of the newly created channel, or `undefined` if creation was skipped.
   */
  async addChannel(
    name: string,
    description: string,
    memberIds: string[] = [],
  ): Promise<string | undefined> {
    const user = this.auth.currentUser?.uid;
    if (!user) return undefined;
    if (await this.channelNameExists(name)) return undefined;

    const docRef = await addDoc(collection(this.db, 'channels'), {
      name,
      description,
      createdBy: user,
      memberIds: Array.from(new Set([user, ...memberIds])),
    });
    return docRef.id;
  }

  /** Adds one or more users to a channel without removing existing members.
   *
   * @param memberIds The user IDs to add to the channel.
   * @param channelId The ID of the channel to update.
   */
  async addMembersToChannel(memberIds: string[], channelId: string): Promise<void> {
    const channelRef = doc(this.db, 'channels', channelId);
    await updateDoc(channelRef, {
      memberIds: arrayUnion(...memberIds),
    });
  }

  /** Updates the name of an existing channel.
   *
   * @param name The new channel name.
   * @param channelId The ID of the channel to update.
   */
  async editChannelName(name: string, channelId: string): Promise<void> {
    const channelRef = doc(this.db, 'channels', channelId);
    await updateDoc(channelRef, {
      name: name,
    });
  }

  /** Updates the description of an existing channel.
   *
   * @param description The new channel description.
   * @param channelId The ID of the channel to update.
   */
  async editChannelDescription(description: string, channelId: string): Promise<void> {
    const channelRef = doc(this.db, 'channels', channelId);
    await updateDoc(channelRef, {
      description: description,
    });
  }

  /** Removes the current user from a channel.
   *
   * @param channelId The ID of the channel to leave.
   */
  async leaveChannel(channelId: string): Promise<void> {
    const user = this.auth.currentUser?.uid;
    if (!user) {
      return;
    }
    const channelRef = doc(this.db, 'channels', channelId);
    await updateDoc(channelRef, {
      memberIds: arrayRemove(user),
    });
  }

  /** Permanently deletes a channel document from Firestore.
   *
   * @param channelId The ID of the channel to delete.
   */
  async deleteChannel(channelId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'channels', channelId));
  }

  /** Adds a message to a channel's message subcollection.
   *
   * @param channelId The ID of the channel receiving the message.
   * @param messageText The text content of the message.
   * @param senderId The ID of the user sending the message.
   */
  async addMessageToChannel(
    channelId: string,
    messageText: string,
    senderId: string,
  ): Promise<void> {
    await addDoc(collection(this.db, 'channels', channelId, 'messages'), {
      createdAt: serverTimestamp(),
      senderId: senderId,
      text: messageText,
    });
  }

  /** Adds a reply to a channel message and increments its thread count.
   *
   * @param channelId The ID of the channel containing the message.
   * @param messageId The ID of the message receiving the reply.
   * @param threadMessage The text content of the reply.
   * @param senderId The ID of the user sending the reply.
   */
  async addChannelThread(
    channelId: string,
    messageId: string,
    threadMessage: string,
    senderId: string,
  ): Promise<void> {
    await addThreadReply(this.db, 'channels', channelId, messageId, threadMessage, senderId);
  }

  /** Adds a user's reaction to a channel message.
   *
   * @param channelId The ID of the channel containing the message.
   * @param messageId The ID of the message to react to.
   * @param reaction The reaction identifier.
   * @param userId The ID of the reacting user.
   */
  async addReactionToChannelMessage(
    channelId: string,
    messageId: string,
    reaction: string,
    userId: string,
  ): Promise<void> {
    const messageRef = doc(this.db, 'channels', channelId, 'messages', messageId);
    await addReaction(messageRef, reaction, userId);
  }

  /** Adds a user's reaction to a channel thread reply.
   *
   * @param channelId The ID of the channel containing the message.
   * @param messageId The ID of the parent message.
   * @param reaction The reaction identifier.
   * @param userId The ID of the reacting user.
   * @param threadId The ID of the thread reply.
   */
  async addReactionToThreadMessage(
    channelId: string,
    messageId: string,
    reaction: string,
    userId: string,
    threadId: string,
  ): Promise<void> {
    await addReaction(this.threadMessageRef(channelId, messageId, threadId), reaction, userId);
  }

  /** Removes a user's reaction from a channel message.
   *
   * @param channelId The ID of the channel containing the message.
   * @param messageId The ID of the message to update.
   * @param reaction The reaction identifier.
   * @param userId The ID of the user whose reaction should be removed.
   */
  async removeReactionFromChannelMessage(
    channelId: string,
    messageId: string,
    reaction: string,
    userId: string,
  ): Promise<void> {
    const messageRef = doc(this.db, 'channels', channelId, 'messages', messageId);
    await removeReaction(messageRef, reaction, userId);
  }

  /** Removes a user's reaction from a channel thread reply.
   *
   * @param channelId The ID of the channel containing the message.
   * @param messageId The ID of the parent message.
   * @param reaction The reaction identifier.
   * @param userId The ID of the user whose reaction should be removed.
   * @param threadId The ID of the thread reply.
   */
  async removeReactionFromThreadMessage(
    channelId: string,
    messageId: string,
    reaction: string,
    userId: string,
    threadId: string,
  ): Promise<void> {
    await removeReaction(this.threadMessageRef(channelId, messageId, threadId), reaction, userId);
  }

  /** Subscribes to all messages in a channel.
   *
   * @param channelId The ID of the channel whose messages should be observed.
   * @returns A signal containing the messages and a function that removes the listener.
   */
  getMessages(
    channelId: string,
    onMessages?: (messages: Message[]) => void,
  ): { messages: ReturnType<typeof signal<Message[]>>; unsubscribe: () => void } {
    return subscribeToMessages(this.db, 'channels', channelId, onMessages);
  }

  /** Subscribes to a single message in a channel.
   *
   * @param channelId The ID of the channel containing the message.
   * @param messageId The ID of the message to observe.
   * @returns A signal containing the message and a function that removes the listener.
   */
  getMessage(
    channelId: string,
    messageId: string,
    onMessage?: (message: Message | null) => void,
  ): { message: ReturnType<typeof signal<Message | null>>; unsubscribe: () => void } {
    return subscribeToMessage(this.db, 'channels', channelId, messageId, onMessage);
  }

  /** Subscribes to all thread replies for a channel message.
   *
   * @param channelId The ID of the channel containing the message.
   * @param messageId The ID of the message whose thread should be observed.
   * @returns A signal containing the thread replies and a function that removes the listener.
   */
  getThreads(
    channelId: string,
    messageId: string,
    onThreadMessages?: (threadMessages: ThreadMessage[]) => void,
  ): { threadMessage: ReturnType<typeof signal<ThreadMessage[]>>; unsubscribe: () => void } {
    return subscribeToThreadReplies(this.db, 'channels', channelId, messageId, onThreadMessages);
  }

  /** Updates the text of a channel message, if the signed-in user is its sender.
   * Does nothing if no user is logged in, or if the user is not the sender.
   *
   * @param channelId The ID of the channel containing the message.
   * @param messageId The ID of the message to edit.
   * @param text The new message text.
   */
  async editChannelMessage(channelId: string, messageId: string, text: string): Promise<void> {
    const messageRef = doc(this.db, 'channels', channelId, 'messages', messageId);
    await editOwnMessageText(this.auth, messageRef, text);
  }

  /** Updates the text of a channel thread reply, if the signed-in user is its sender.
   *
   * @param channelId The ID of the channel containing the thread.
   * @param messageId The ID of the parent message.
   * @param threadId The ID of the thread reply to edit.
   * @param text The new reply text.
   */
  async editThreadMessage(
    channelId: string,
    messageId: string,
    threadId: string,
    text: string,
  ): Promise<void> {
    const threadRef = this.threadMessageRef(channelId, messageId, threadId);
    await editOwnMessageText(this.auth, threadRef, text);
  }

  /** Deletes every message and thread reply authored by the given user, across all
   * channels; strips their reactions from everyone else's messages/replies; and
   * decrements each parent message's threadCount by the number of its thread
   * replies that were deleted.
   *
   * @param senderId The UID of the departing guest.
   */
  async deleteGuestMessages(senderId: string): Promise<void> {
    await deleteGuestContent(this.db, 'channels', senderId, { filterByMembership: false });
  }

  /** Removes the given user from every channel they're a member of, deleting
   * channels they created outright and channels left with no members.
   *
   * @param uid The UID of the departing guest.
   */
  async removeGuestFromChannels(uid: string): Promise<void> {
    await pruneGuestFromChannels(this.db, uid);
  }
}
