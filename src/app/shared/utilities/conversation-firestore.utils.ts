import { signal } from '@angular/core';
import { Auth } from 'firebase/auth';
import { CollectionReference, DocumentData, DocumentReference, Firestore, Query, QueryDocumentSnapshot, WriteBatch, addDoc, arrayRemove, arrayUnion, collection, deleteField, doc, getDoc, getDocs, increment, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch} from 'firebase/firestore';
import { Channel } from '../interfaces/channel';
import { Message } from '../interfaces/message';
import { ThreadMessage } from '../interfaces/thread';

/** The Firestore collection a channel or direct-message conversation lives under. */
export type ConversationRoot = 'channels' | 'dms';

function logListenerError(root: ConversationRoot, err: { code: string; message: string }): void {
  if (err.code !== 'permission-denied') {
    console.error(`[${root}-Messages-Listener]`, err.code, err.message);
  }
}

/** Subscribes to all messages of a channel or DM conversation, ordered by creation time. */
export function subscribeToMessages(
  db: Firestore,
  root: ConversationRoot,
  conversationId: string,
  onMessages?: (messages: Message[]) => void,
): { messages: ReturnType<typeof signal<Message[]>>; unsubscribe: () => void } {
  const messages = signal<Message[]>([]);
  const messagesRef = query(collection(db, root, conversationId, 'messages'), orderBy('createdAt', 'asc'));
  const unsubscribe = onSnapshot(
    messagesRef,
    (snapshot) => {
      const values = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Message) }));
      messages.set(values);
      onMessages?.(values);
    },
    (err) => logListenerError(root, err),
  );
  return { messages, unsubscribe };
}

/** Subscribes to a single message of a channel or DM conversation. */
export function subscribeToMessage(
  db: Firestore,
  root: ConversationRoot,
  conversationId: string,
  messageId: string,
  onMessage?: (message: Message | null) => void,
): { message: ReturnType<typeof signal<Message | null>>; unsubscribe: () => void } {
  const message = signal<Message | null>(null);
  const messageRef = doc(db, root, conversationId, 'messages', messageId);
  const unsubscribe = onSnapshot(
    messageRef,
    (snapshot) => {
      const value = snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as Message) } : null;
      message.set(value);
      onMessage?.(value);
    },
    (err) => logListenerError(root, err),
  );
  return { message, unsubscribe };
}

/** Subscribes to all thread replies of a channel or DM message. */
export function subscribeToThreadReplies(
  db: Firestore,
  root: ConversationRoot,
  conversationId: string,
  messageId: string,
  onThreadMessages?: (threadMessages: ThreadMessage[]) => void,
): { threadMessage: ReturnType<typeof signal<ThreadMessage[]>>; unsubscribe: () => void } {
  const threadMessage = signal<ThreadMessage[]>([]);
  const threadRef = query(
    collection(db, root, conversationId, 'messages', messageId, 'thread'),
    orderBy('createdAt', 'asc'),
  );
  const unsubscribe = onSnapshot(threadRef, (snapshot) => {
    const values = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ThreadMessage) }));
    threadMessage.set(values);
    onThreadMessages?.(values);
  }, (err) => logListenerError(root, err));
  return { threadMessage, unsubscribe };
}

/** Adds a reply to a channel or DM message and increments its thread count. */
export async function addThreadReply(
  db: Firestore,
  root: ConversationRoot,
  conversationId: string,
  messageId: string,
  text: string,
  senderId: string,
): Promise<void> {
  await addDoc(collection(db, root, conversationId, 'messages', messageId, 'thread'), {
    text,
    senderId,
    createdAt: serverTimestamp(),
  });
  const messageRef = doc(db, root, conversationId, 'messages', messageId);
  await updateDoc(messageRef, { threadCount: increment(1) });
}

/** Adds a user's reaction to a message or thread reply. */
export async function addReaction(
  messageRef: DocumentReference,
  reaction: string,
  userId: string,
): Promise<void> {
  await updateDoc(messageRef, { [`reactions.${reaction}`]: arrayUnion(userId) });
}

/** Removes a user's reaction from a message or thread reply, clearing the emoji
 * entry entirely once its last reactor is removed. */
export async function removeReaction(
  messageRef: DocumentReference,
  reaction: string,
  userId: string,
): Promise<void> {
  const snapshot = await getDoc(messageRef);
  const currentUserIds: string[] = snapshot.data()?.['reactions']?.[reaction] ?? [];
  const remaining = currentUserIds.filter((id) => id !== userId);
  await updateDoc(messageRef, {
    [`reactions.${reaction}`]: remaining.length === 0 ? deleteField() : arrayRemove(userId),
  });
}

/** Builds the field updates needed to remove a departing guest's uid from a
 * reactions map. Returns an empty object if there's nothing to remove. */
export function buildReactionRemovalUpdates(
  reactions: Record<string, string[]> | undefined,
  senderId: string,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  if (!reactions) return updates;

  for (const [emoji, userIds] of Object.entries(reactions)) {
    if (!userIds.includes(senderId)) continue;
    const remaining = userIds.filter((id) => id !== senderId);
    updates[`reactions.${emoji}`] = remaining.length === 0 ? deleteField() : arrayRemove(senderId);
  }

  return updates;
}

/** Updates a message's or thread reply's text if the signed-in user is its author.
 * Does nothing if nobody is signed in or if they are not the author. */
export async function editOwnMessageText(
  auth: Auth,
  messageRef: DocumentReference,
  text: string,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const snapshot = await getDoc(messageRef);
  const message = snapshot.data() as { senderId?: string } | undefined;
  if (message?.senderId !== uid) return;
  await updateDoc(messageRef, { text });
}

function queueReactionRemoval(
  batch: WriteBatch,
  ref: DocumentReference,
  reactions: Record<string, string[]> | undefined,
  senderId: string,
): boolean {
  const updates = buildReactionRemovalUpdates(reactions, senderId);
  if (Object.keys(updates).length === 0) return false;
  batch.update(ref, updates);
  return true;
}

function queueMessageUpdate(
  batch: WriteBatch,
  ref: DocumentReference,
  reactions: Record<string, string[]> | undefined,
  senderId: string,
  deletedReplyCount: number,
): boolean {
  const updates = buildReactionRemovalUpdates(reactions, senderId);
  if (deletedReplyCount > 0) updates['threadCount'] = increment(-deletedReplyCount);
  if (Object.keys(updates).length === 0) return false;
  batch.update(ref, updates);
  return true;
}

async function cleanupMessageThread(
  db: Firestore,
  root: ConversationRoot,
  conversationId: string,
  messageId: string,
  senderId: string,
  batch: WriteBatch,
): Promise<{ deletedReplyCount: number; hadWrites: boolean }> {
  const threadRef = collection(db, root, conversationId, 'messages', messageId, 'thread');
  const replies = (await getDocs(threadRef)).docs.map((d) => ({ doc: d, data: d.data() as ThreadMessage }));
  const toDelete = replies.filter((r) => r.data.senderId === senderId);
  toDelete.forEach((r) => batch.delete(r.doc.ref));
  const toUpdate = replies.filter((r) => r.data.senderId !== senderId);
  const updatedCount = toUpdate.filter((r) => queueReactionRemoval(batch, r.doc.ref, r.data.reactions, senderId)).length;
  return { deletedReplyCount: toDelete.length, hadWrites: toDelete.length > 0 || updatedCount > 0 };
}

async function cleanupMessage(
  db: Firestore,
  root: ConversationRoot,
  conversationId: string,
  messageDoc: QueryDocumentSnapshot<DocumentData>,
  senderId: string,
  batch: WriteBatch,
): Promise<boolean> {
  const message = messageDoc.data() as Message;
  const { deletedReplyCount, hadWrites: threadHadWrites } = await cleanupMessageThread(
    db, root, conversationId, messageDoc.id, senderId, batch,
  );
  if (message.senderId === senderId) {
    batch.delete(messageDoc.ref);
    return true;
  }
  return queueMessageUpdate(batch, messageDoc.ref, message.reactions, senderId, deletedReplyCount) || threadHadWrites;
}

async function cleanupConversationMessages(
  db: Firestore,
  root: ConversationRoot,
  conversationId: string,
  senderId: string,
  batch: WriteBatch,
): Promise<boolean> {
  const allMessages = await getDocs(collection(db, root, conversationId, 'messages'));
  let hasWrites = false;
  for (const messageDoc of allMessages.docs) {
    const wrote = await cleanupMessage(db, root, conversationId, messageDoc, senderId, batch);
    hasWrites = wrote || hasWrites;
  }
  return hasWrites;
}

function getConversationsRef(
  db: Firestore,
  root: ConversationRoot,
  senderId: string,
  filterByMembership: boolean,
): Query<DocumentData> | CollectionReference<DocumentData> {
  const conversations = collection(db, root);
  return filterByMembership
    ? query(conversations, where('memberIds', 'array-contains', senderId))
    : conversations;
}

/** Deletes every message and thread reply authored by the given user, across all
 * channel or DM conversations; strips their reactions from everyone else's
 * messages/replies; and decrements each parent message's threadCount by the number
 * of its thread replies that were deleted.
 *
 * `filterByMembership` should be `true` for DMs, where membership is a reliable
 * way to find the user's conversations. Channels pass `false` and scan every
 * channel, since a departing guest may already have been removed from `memberIds`
 * by the time this runs. */
export async function deleteGuestContent(
  db: Firestore,
  root: ConversationRoot,
  senderId: string,
  options: { filterByMembership: boolean },
): Promise<void> {
  const conversationsSnapshot = await getDocs(
    getConversationsRef(db, root, senderId, options.filterByMembership),
  );
  const batch = writeBatch(db);
  let hasWrites = false;

  for (const conversationDoc of conversationsSnapshot.docs) {
    const wrote = await cleanupConversationMessages(db, root, conversationDoc.id, senderId, batch);
    hasWrites = wrote || hasWrites;
  }

  if (hasWrites) await batch.commit();
}

function queueChannelMembershipUpdate(
  batch: WriteBatch,
  channelDoc: QueryDocumentSnapshot<DocumentData>,
  uid: string,
): void {
  const channel = channelDoc.data() as Channel;
  if (channel.createdBy === uid) {
    batch.delete(channelDoc.ref);
    return;
  }
  const remainingMembers = channel.memberIds.filter((memberId: string) => memberId !== uid);
  if (remainingMembers.length === 0) {
    batch.delete(channelDoc.ref);
  } else {
    batch.update(channelDoc.ref, { memberIds: remainingMembers });
  }
}

/** Removes the given user from every channel they're a member of, deleting
 * channels they created outright and channels left with no members. */
export async function pruneGuestFromChannels(db: Firestore, uid: string): Promise<void> {
  const channelsSnapshot = await getDocs(
    query(collection(db, 'channels'), where('memberIds', 'array-contains', uid)),
  );
  const batch = writeBatch(db);
  channelsSnapshot.docs.forEach((channelDoc) => queueChannelMembershipUpdate(batch, channelDoc, uid));
  if (!channelsSnapshot.empty) await batch.commit();
}
