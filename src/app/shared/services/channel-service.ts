import { Service, inject, signal } from '@angular/core';
import { FIREBASE_FIRESTORE } from '../../app.config';
import { Channel } from '../interfaces/channel';
import { collection, onSnapshot, addDoc, doc, updateDoc } from "firebase/firestore";

@Service()
export class ChannelService {
    private db = inject(FIREBASE_FIRESTORE);
    channels = signal<Channel[]>([]);

    constructor() {
        const channelsRef = collection(this.db, 'channels');
        onSnapshot(channelsRef, snapshot => {
            const channels = snapshot.docs.map(
                doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Channel)
            );
            this.channels.set(channels);
            console.log(this.channels());
        });
    }

    // missing: memberIds, createdBy
    async addChannel(name: string, description: string) {
        const docRef = await addDoc(collection(this.db, "channels"), {
            name: name,
            description: description
        });
        console.log("Document written with ID: ", docRef.id);
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

    // addMembers
    // leaveChannel
    

}
