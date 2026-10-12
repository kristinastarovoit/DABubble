import { inject, Service, signal, effect } from '@angular/core';
import { FIREBASE_DATABASE } from '../../app.config';
import { AuthService } from './auth';
import { onDisconnect, onValue, ref, serverTimestamp, set } from 'firebase/database';

type PresenceState = 'online' | 'offline';

@Service()
export class Presence {
  private database = inject(FIREBASE_DATABASE);
  private authService = inject(AuthService);

  private presenceByUid = signal<Record<string, PresenceState>>({});

  constructor() {
    const statusRef = ref(this.database, 'status');
    onValue(statusRef, (snapshot) => {
      const raw = (snapshot.val() ?? {}) as Record<string, { state?: PresenceState }>;
      const next: Record<string, PresenceState> = {};
      for (const uid in raw) {
        next[uid] = raw[uid]?.state === 'online' ? 'online' : 'offline';
      }
      this.presenceByUid.set(next);
    });

    effect(() => {
      const uid = this.authService.currentUserId();
      if (uid) this.trackOwnPresence(uid);
    });
  }

  isOnline(uid: string | undefined): boolean {
    if (!uid) return false;
    return this.presenceByUid()[uid] === 'online';
  }

  private trackOwnPresence(uid: string): void {
    const myStatusRef = ref(this.database, `status/${uid}`);
    const connectedRef = ref(this.database, '.info/connected');

    onValue(connectedRef, (snapshot) => {
      if (snapshot.val() !== true) return;
    });

    onDisconnect(myStatusRef)
      .set({
        state: 'offline' satisfies PresenceState,
        lastChanged: serverTimestamp(),
      })
      .then(() => {
        set(myStatusRef, {
          state: 'online' satisfies PresenceState,
          lastChanged: serverTimestamp(),
        });
      });
  }

  async goOffline(): Promise<void> {
    const uid = this.authService.currentUserId();
    if (!uid) return;
    await set(ref(this.database, `status/${uid}`), {
      state: 'offline' satisfies PresenceState,
      lastChanged: serverTimestamp(),
    });
  }
}
