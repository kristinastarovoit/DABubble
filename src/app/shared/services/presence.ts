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

    effect((onCleanup) => {
      const uid = this.authService.currentUserId();
      if (!uid) return;

      const myStatusRef = ref(this.database, `status/${uid}`);
      const connectedRef = ref(this.database, '.info/connected');

      const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
        if (snapshot.val() !== true) return;

        onDisconnect(myStatusRef)
          .set({
            state: 'offline' satisfies PresenceState,
            lastChanged: serverTimestamp(),
          })
          .then(() => {
            return set(myStatusRef, {
              state: 'online' satisfies PresenceState,
              lastChanged: serverTimestamp(),
            });
          })
          .then(() => {
            // Optimistic local update: don't rely solely on the global listener
            // picking up our own write, which can lag after a reconnect.
            this.presenceByUid.update((current) => ({ ...current, [uid]: 'online' }));
          })
          .catch((error) => {
            console.error('[Presence] failed to register presence', error);
          });
      });

      onCleanup(() => {
        unsubscribeConnected();
      });
    });
  }

  isOnline(uid: string | undefined, fallbackStatus?: string): boolean {
    if (!uid) return false;
    const presence = this.presenceByUid()[uid];
    if (presence !== undefined) return presence === 'online';
    return fallbackStatus === 'online';
  }

  async goOffline(): Promise<void> {
    const uid = this.authService.currentUserId();
    if (!uid) return;
    await set(ref(this.database, `status/${uid}`), {
      state: 'offline' satisfies PresenceState,
      lastChanged: serverTimestamp(),
    });
    this.presenceByUid.update((current) => ({ ...current, [uid]: 'offline' }));
  }
}
