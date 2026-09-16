import { Service, inject, signal } from '@angular/core';
import { FIREBASE_FIRESTORE, FIREBASE_AUTH } from '../../app.config';
import { Channel } from '../interfaces/channel';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp, increment, query, where } from "firebase/firestore";
import { Message } from '../interfaces/message';
import { ThreadMessage } from '../interfaces/thread';
import { onAuthStateChanged } from 'firebase/auth';

@Service()
export class ChannelService {
    private db = inject(FIREBASE_FIRESTORE);
    private auth = inject(FIREBASE_AUTH);
    channels = signal<Channel[]>([]);

    constructor() {
        onAuthStateChanged(this.auth, (user) => {
            if (!user) {
                this.channels.set([]);
                return;
            }
            const channelsRef = collection(this.db, 'channels');
            const q = query(channelsRef, where('memberIds', 'array-contains', user.uid));

            onSnapshot(q, snapshot => {
                const channels = snapshot.docs.map(
                    doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as Channel)
                );
                this.channels.set(channels);
                console.log(this.channels());
            });
        });
    }

    async addChannel(name: string, description: string) {
        const user = this.auth.currentUser?.uid;
        if (!user) { return }

        const channelRef = await addDoc(collection(this.db, "channels"), {
            name: name,
            description: description,
            createdBy: user,
            memberIds: [user]
        });
        console.log("Channel written with ID: ", channelRef.id);
    }


    // noch anpassen, je nachdem welcher channel gerade offen ist / ob einer offen ist
    async addMembersToChannel(memberIds: string[], channelId: string) {
        const channelRef = doc(this.db, "channels", channelId);
        await updateDoc(channelRef, {
            memberIds: arrayUnion(...memberIds)
        });
        console.log("User for channel written with ID: ", channelRef.id);
    }

    async editChannelName(name: string, channelId: string) {
        const channelRef = doc(this.db, "channels", channelId);
        await updateDoc(channelRef, {
            name: name
        });
    }

    async editChannelDescription(description: string, channelId: string) {
        const channelRef = doc(this.db, "channels", channelId);
        await updateDoc(channelRef, {
            description: description
        });
    }

    async leaveChannel(channelId: string) {
        const user = this.auth.currentUser?.uid;
        if (!user) { return };
        const channelRef = doc(this.db, "channels", channelId);
        await updateDoc(channelRef, {
            memberIds: arrayRemove(user)
        });
        console.log("User in channel removed with ID: ", channelRef.id);
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

    async deleteChannel(channelId: string) {
        await deleteDoc(doc(this.db, "channels", channelId));
    }

    async addMessageToChannel(channelId: string, messageText: string, senderId: string) {
        const messageRef = await addDoc(collection(this.db, "channels", channelId, "messages"), {
            createdAt: serverTimestamp(),
            senderId: senderId,
            text: messageText,
        });
        console.log("message in channel written with ID: ", messageRef.id);
    }

    async addChannelThread(channelId: string, messageId: string, threadMessage: string, senderId: string) {
        const threadMessageRef = await addDoc(collection(this.db, "channels", channelId, "messages", messageId, "thread"), {
            text: threadMessage,
            senderId: senderId,
            createdAt: serverTimestamp(),

        });
        console.log("Thread message written with ID: ", threadMessageRef.id);

        const threadRef = doc(this.db, "channels", channelId, "messages", messageId);
        await updateDoc(threadRef, {
            threadCount: increment(1)
        });
    }

    getMessages(channelId: string) {
        const messages = signal<Message[]>([]);
        const messagesRef = collection(this.db, 'channels', channelId, 'messages');
        const unsubscribe = onSnapshot(messagesRef, snapshot => {
            messages.set(
                snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Message) }))
            );
        });
        return { messages, unsubscribe };
    }

    getThreads(channelId: string, messageId: string) {
        const threadMessage = signal<ThreadMessage[]>([]);
        const threadRef = collection(this.db, 'channels', channelId, 'messages', messageId, "thread");
        const unsubscribe = onSnapshot(threadRef, snapshot => {
            threadMessage.set(
                snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as ThreadMessage) }))
            );
        });
        return { threadMessage, unsubscribe };
    }

}
