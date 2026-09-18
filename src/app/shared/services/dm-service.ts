import { Service, computed, inject, signal } from '@angular/core';
import { FIREBASE_FIRESTORE, FIREBASE_AUTH } from '../../app.config';
import { Dm } from '../interfaces/dm';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { Message } from '../interfaces/message';
import { ThreadMessage } from '../interfaces/thread';
import { onAuthStateChanged } from 'firebase/auth';
import { UserService } from './users';

@Service()
/** Provides Firestore operations and reactive direct-message data. */
export class DmService {
  private db = inject(FIREBASE_FIRESTORE);
  private auth = inject(FIREBASE_AUTH);

  private userService = inject(UserService);

  /** The direct-message conversations available to the application. */
  dms = signal<Dm[]>([]);
  /** Identifier of the currently active direct-message conversation, or `undefined` if none is selected. */
  activeDmId = signal<string | undefined>(undefined);
  /** UID of the currently authenticated user, or `undefined` when logged out. */
  currentUserId = signal<string | undefined>(undefined);

  /** Sets the active direct-message conversation.
   *
   * @param dmId The ID of the direct-message conversation to select.
   */
  selectDm(dmId: string): void {
    this.activeDmId.set(dmId);
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
    onAuthStateChanged(this.auth, async (user) => {
      this.currentUserId.set(user?.uid);
      if (!user) {
        this.dms.set([]);
        this.activeDmId.set(undefined);
        return;
      }
      await this.ensureSelfDm(user.uid);
      const dmsRef = collection(this.db, 'dms');
      const q = query(dmsRef, where('memberIds', 'array-contains', user.uid));

      onSnapshot(q, (snapshot) => {
        const dms = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Dm);
        this.dms.set(dms);
        if (!this.activeDmId() && dms.length > 0) {
          this.activeDmId.set(dms[0].id);
        }
        console.log(this.dms());
      });
    });
  }

  // für die components: @Component({...})
  // export class DmChatComponent {
  //   private dmService = inject(DmService);
  //   dmId = input.required<string>();  // aus der Route

  //   messages = computed(() => this.dmService.getMessages(this.dmId()));
  // }

  // unsubscribe in ngondestroy

  /** Subscribes to all messages in a direct-message conversation.
   *
   * @param dmId The ID of the direct-message conversation.
   * @returns A signal containing the messages and a function that removes the listener.
   */
  getMessages(
    dmId: string,
    onMessages?: (messages: Message[]) => void,
  ): { messages: ReturnType<typeof signal<Message[]>>; unsubscribe: () => void } {
    const messages = signal<Message[]>([]);
    const messagesRef = collection(this.db, 'dms', dmId, 'messages');
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const dmMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Message) }));
      messages.set(dmMessages);
      onMessages?.(dmMessages);
    });
    return { messages, unsubscribe };
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
  ): { threadMessage: ReturnType<typeof signal<ThreadMessage[]>>; unsubscribe: () => void } {
    const threadMessage = signal<ThreadMessage[]>([]);
    const threadRef = collection(this.db, 'dms', dmId, 'messages', messageId, 'thread');
    const unsubscribe = onSnapshot(threadRef, (snapshot) => {
      threadMessage.set(
        snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ThreadMessage) })),
      );
    });
    return { threadMessage, unsubscribe };
  }

  /** Creates a direct-message conversation for the specified users.
   *
   * @param memberIds The user IDs participating in the conversation.
   */
  async addDm(memberIds: string[]): Promise<void> {
    const docRef = await addDoc(collection(this.db, 'dms'), {
      memberIds: memberIds,
      lastMessageAt: serverTimestamp(),
    });
    console.log('DM written with ID: ', docRef.id);
  }

  /** Adds a message to a direct-message conversation and updates its timestamp.
   *
   * @param dmId The ID of the direct-message conversation.
   * @param messageText The text content of the message.
   * @param senderId The ID of the user sending the message.
   */
  async addMessageToDm(dmId: string, messageText: string, senderId: string): Promise<void> {
    const messageRef = await addDoc(collection(this.db, 'dms', dmId, 'messages'), {
      createdAt: serverTimestamp(),
      senderId: senderId,
      text: messageText,
    });
    console.log('message written with ID: ', messageRef.id);

    const dmRef = doc(this.db, 'dms', dmId);
    await updateDoc(dmRef, {
      lastMessageAt: serverTimestamp(),
    });
    console.log('Message written with ID: ', dmRef.id);
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
    const threadMessageRef = await addDoc(
      collection(this.db, 'dms', dmId, 'messages', messageId, 'thread'),
      {
        text: threadMessage,
        senderId: senderId,
        createdAt: serverTimestamp(),
      },
    );
    console.log('Thread message written with ID: ', threadMessageRef.id);
    const threadRef = doc(this.db, 'dms', dmId, 'messages', messageId);
    await updateDoc(threadRef, {
      threadCount: increment(1),
    });
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
    await updateDoc(messageRef, {
      [`reactions.${reaction}`]: arrayUnion(userId),
    });
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
    await updateDoc(messageRef, {
      [`reactions.${reaction}`]: arrayUnion(userId),
    });
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
    await updateDoc(messageRef, {
      [`reactions.${reaction}`]: arrayRemove(userId),
    });
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
    await updateDoc(messageRef, {
      [`reactions.${reaction}`]: arrayRemove(userId),
    });
  }

  /** All workspace users eligible for direct messaging, each paired with their existing DM
   * conversation (if any) and whether they are the signed-in user. Excludes users named
   * "Guest", except the signed-in user themself. Sorted alphabetically by name.
   */
  dmPartners = computed(() => {
    const currentUserId = this.currentUserId();
    const allUsers = this.userService.users();
    const dms = this.dms();

    return allUsers
      .filter((user) => user.name !== 'Guest' || user.uid === currentUserId)
      .map((user) => {
        const isSelf = user.uid === currentUserId;
        const existingDm = dms.find((dm) =>
          isSelf
            ? dm.memberIds.length === 1 && dm.memberIds[0] === currentUserId
            : dm.memberIds.includes(currentUserId!) && dm.memberIds.includes(user.uid),
        );
        return { user, isSelf, dm: existingDm ?? null };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name, 'de'));
  });
}
