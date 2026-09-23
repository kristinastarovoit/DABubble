import { Service, inject, signal } from '@angular/core';
import { FIREBASE_FIRESTORE, FIREBASE_AUTH } from '../../app.config';
import { Channel } from '../interfaces/channel';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  increment,
  query,
  where,
  getDocs,
  queryEqual,
  getDoc,
  deleteField,
} from 'firebase/firestore';
import { Message } from '../interfaces/message';
import { ThreadMessage } from '../interfaces/thread';
import { onAuthStateChanged } from 'firebase/auth';
import { NewMessageService } from './new-message-service';

@Service()
/** Provides Firestore operations and reactive channel data for the current user. */
export class ChannelService {
  private db = inject(FIREBASE_FIRESTORE);
  private auth = inject(FIREBASE_AUTH);
  private newMessageService = inject(NewMessageService);

  /** The channels in which the currently authenticated user is a member. */
  channels = signal<Channel[]>([]);
  activeChannelId = signal<string | undefined>(undefined);

  selectChannel(channelId: string): void {
    this.activeChannelId.set(channelId);
    this.newMessageService.close();
  }

  private unsubscribeChannels?: () => void;
  private initialChannelSelected = false;

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.unsubscribeChannels?.();
      this.unsubscribeChannels = undefined;

      if (!user) {
        this.channels.set([]);
        this.activeChannelId.set(undefined);
        this.initialChannelSelected = false;
        return;
      }

      const channelsRef = collection(this.db, 'channels');
      this.unsubscribeChannels = onSnapshot(
        channelsRef,
        (snapshot) => {
          const channels = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Channel);
          this.channels.set(channels);

          if (!this.initialChannelSelected && channels.length > 0) {
            const general = channels.find((c) => c.name === 'Allgemeines') ?? channels[0];
            this.selectChannel(general.id);
            this.initialChannelSelected = true;
          }
        },
        (err) => console.error('[Channels-Listener]', err.code, err.message),
      );
    });
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

    const channelsRef = collection(this.db, 'channels');
    const q = query(channelsRef, where('name', '==', name));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) return undefined;

    const docRef = await addDoc(channelsRef, {
      name,
      description,
      createdBy: user,
      memberIds: Array.from(new Set([user, ...memberIds])),
    });

    return docRef.id;
  }

  // noch anpassen, je nachdem welcher channel gerade offen ist / ob einer offen ist
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
    console.log('User for channel written with ID: ', channelRef.id);
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
    console.log('User in channel removed with ID: ', channelRef.id);
  }

  // To delete an entire collection or subcollection in Cloud Firestore,
  // retrieve (read) all the documents within the collection or subcollection and delete them.
  // This process incurs both read and delete costs. If you have larger collections, you may
  // want to delete the documents in smaller batches to avoid out-of-memory errors. Repeat the
  // process until you've deleted the entire collection or subcollection.

  // Deleting a collection requires coordinating an unbounded number of individual delete requests.
  // If you need to delete entire collections, do so only from a trusted server environment.
  // While it is possible to delete a collection from a mobile/web client, doing so has negative
  // security and performance implications.

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
    const messageRef = await addDoc(collection(this.db, 'channels', channelId, 'messages'), {
      createdAt: serverTimestamp(),
      senderId: senderId,
      text: messageText,
    });
    console.log('message in channel written with ID: ', messageRef.id);
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
    const threadMessageRef = await addDoc(
      collection(this.db, 'channels', channelId, 'messages', messageId, 'thread'),
      {
        text: threadMessage,
        senderId: senderId,
        createdAt: serverTimestamp(),
      },
    );
    console.log('Thread message written with ID: ', threadMessageRef.id);

    const threadRef = doc(this.db, 'channels', channelId, 'messages', messageId);
    await updateDoc(threadRef, {
      threadCount: increment(1),
    });
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
    await updateDoc(messageRef, {
      [`reactions.${reaction}`]: arrayUnion(userId),
    });
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
    const messageRef = doc(
      this.db,
      'channels',
      channelId,
      'messages',
      messageId,
      'thread',
      threadId,
    );
    await updateDoc(messageRef, {
      [`reactions.${reaction}`]: arrayUnion(userId),
    });
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
    const snapshot = await getDoc(messageRef);
    const currentUserIds: string[] = snapshot.data()?.['reactions']?.[reaction] ?? [];
    const remaining = currentUserIds.filter((id) => id !== userId);

    if (remaining.length === 0) {
      await updateDoc(messageRef, {
        [`reactions.${reaction}`]: deleteField(),
      });
    } else {
      await updateDoc(messageRef, {
        [`reactions.${reaction}`]: arrayRemove(userId),
      });
    }
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
    const messageRef = doc(
      this.db,
      'channels',
      channelId,
      'messages',
      messageId,
      'thread',
      threadId,
    );
    const snapshot = await getDoc(messageRef);
    const currentUserIds: string[] = snapshot.data()?.['reactions']?.[reaction] ?? [];
    const remaining = currentUserIds.filter((id) => id !== userId);

    if (remaining.length === 0) {
      await updateDoc(messageRef, {
        [`reactions.${reaction}`]: deleteField(),
      });
    } else {
      await updateDoc(messageRef, {
        [`reactions.${reaction}`]: arrayRemove(userId),
      });
    }
  }

  // unsubscribe in ngondestroy in der component
  /** Subscribes to all messages in a channel.
   *
   * @param channelId The ID of the channel whose messages should be observed.
   * @returns A signal containing the messages and a function that removes the listener.
   */
  getMessages(
    channelId: string,
    onMessages?: (messages: Message[]) => void,
  ): { messages: ReturnType<typeof signal<Message[]>>; unsubscribe: () => void } {
    const messages = signal<Message[]>([]);
    const messagesRef = collection(this.db, 'channels', channelId, 'messages');
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const channelMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Message),
      }));
      messages.set(channelMessages);
      onMessages?.(channelMessages);
    });
    return { messages, unsubscribe };
  }

  getMessage(
    channelId: string,
    messageId: string,
    onMessage?: (message: Message | null) => void,
  ): { message: ReturnType<typeof signal<Message | null>>; unsubscribe: () => void } {
    const message = signal<Message | null>(null);
    const messageRef = doc(this.db, 'channels', channelId, 'messages', messageId);
    const unsubscribe = onSnapshot(messageRef, (snapshot) => {
      const value = snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as Message) } : null;
      message.set(value);
      onMessage?.(value);
    });
    return { message, unsubscribe };
  }

  // unsubscribe in ngondestroy in der component
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
    const threadMessage = signal<ThreadMessage[]>([]);
    const threadRef = collection(this.db, 'channels', channelId, 'messages', messageId, 'thread');
    const unsubscribe = onSnapshot(threadRef, (snapshot) => {
      const threadMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as ThreadMessage),
      }));
      threadMessage.set(threadMessages);
      onThreadMessages?.(threadMessages);
    });
    return { threadMessage, unsubscribe };
  }

  /** Updates the text of a channel message, if the signed-in user is its sender.
   * Does nothing if no user is logged in, or if the user is not the sender.
   *
   * @param channelId The ID of the channel containing the message.
   * @param messageId The ID of the message to edit.
   * @param text The new message text.
   */
  async editChannelMessage(channelId: string, messageId: string, text: string) {
    const user = this.auth.currentUser?.uid;
    if (!user) {
      return;
    }
    const channelRef = doc(this.db, 'channels', channelId, 'messages', messageId);
    const snapshot = await getDoc(channelRef);
    const message = snapshot.data() as Message;
    if (message?.senderId !== user) {
      return;
    }
    await updateDoc(channelRef, {
      text: text,
    });
  }

  /** Updates the text of a channel thread reply, if the signed-in user is its sender.
   *
   * @param channelId The ID of the channel containing the thread.
   * @param messageId The ID of the parent message.
   * @param threadId The ID of the thread reply to edit.
   * @param text The new reply text.
   */
  async editThreadMessage(channelId: string, messageId: string, threadId: string, text: string) {
    const user = this.auth.currentUser?.uid;
    if (!user) {
      return;
    }

    const threadRef = doc(
      this.db,
      'channels',
      channelId,
      'messages',
      messageId,
      'thread',
      threadId,
    );
    const snapshot = await getDoc(threadRef);
    const threadMessage = snapshot.data() as ThreadMessage;

    if (threadMessage?.senderId !== user) {
      return;
    }

    await updateDoc(threadRef, {
      text: text,
    });
  }
}
