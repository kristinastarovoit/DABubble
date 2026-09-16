import { Service, inject, signal } from '@angular/core';
import { FIREBASE_FIRESTORE } from '../../app.config';
import { Dm } from '../interfaces/dm';
import { collection, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, increment } from "firebase/firestore";
import { Message } from '../interfaces/message';
import { ThreadMessage } from '../interfaces/thread';


@Service()
export class DmService {
    private db = inject(FIREBASE_FIRESTORE);
    dms = signal<Dm[]>([]);

    constructor() {
        const dmsRef = collection(this.db, 'dms');
        onSnapshot(dmsRef, snapshot => {
            const dms = snapshot.docs.map(
                doc => ({ id: doc.id, ...doc.data() } as Dm)
            );
            this.dms.set(dms);
            console.log(this.dms());
        });
    }


    // für die components: @Component({...})
    // export class DmChatComponent {
    //   private dmService = inject(DmService);
    //   dmId = input.required<string>();  // aus der Route

    //   messages = computed(() => this.dmService.getMessages(this.dmId()));
    // }

    // unsubscribe in ngondestroy

    getMessages(dmId: string) {
        const messages = signal<Message[]>([]);
        const messagesRef = collection(this.db, 'dms', dmId, 'messages');
        const unsubscribe = onSnapshot(messagesRef, snapshot => {
            messages.set(
                snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Message) }))
            );
        });
        return { messages, unsubscribe };
    }

    getThreads(dmId: string, messageId: string) {
        const threadMessage = signal<ThreadMessage[]>([]);
        const threadRef = collection(this.db, 'dms', dmId, 'messages', messageId, "thread");
        const unsubscribe = onSnapshot(threadRef, snapshot => {
            threadMessage.set(
                snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as ThreadMessage) }))
            );
        });
        return { threadMessage, unsubscribe };
    }

    async addDm(memberIds: string[]) {
        const docRef = await addDoc(collection(this.db, "dms"), {
            memberIds: memberIds,
            lastMessageAt: serverTimestamp(),
        });
        console.log("DM written with ID: ", docRef.id);
    }

    async addMessageToDm(dmId: string, messageText: string, senderId: string) {
        const messageRef = await addDoc(collection(this.db, "dms", dmId, "messages"), {
            createdAt: serverTimestamp(),
            senderId: senderId,
            text: messageText,
        });
        console.log("message written with ID: ", messageRef.id);

        const dmRef = doc(this.db, "dms", dmId);
        await updateDoc(dmRef, {
            lastMessageAt: serverTimestamp(),
        });
        console.log("Message written with ID: ", dmRef.id);
    }

    async addDmThread(dmId: string, messageId: string, threadMessage: string, senderId: string) {
        const threadMessageRef = await addDoc(collection(this.db, "dms", dmId, "messages", messageId, "thread"), {
            text: threadMessage,
            senderId: senderId,
            createdAt: serverTimestamp(),

        });
        console.log("Thread message written with ID: ", threadMessageRef.id);
        const threadRef = doc(this.db, "dms", dmId, "messages", messageId);
        await updateDoc(threadRef, {
            threadCount: increment(1)
        });
    }
}
