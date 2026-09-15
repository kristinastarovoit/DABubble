import { Service, inject, signal } from '@angular/core';
import { FIREBASE_FIRESTORE } from '../../app.config';
import { Channel } from '../interfaces/channel';
import { collection, onSnapshot } from "firebase/firestore";

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
}
