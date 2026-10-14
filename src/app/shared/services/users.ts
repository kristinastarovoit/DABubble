import { Service, effect, inject, signal } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  deleteDoc,
  query,
  collectionGroup,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

import { FIREBASE_FIRESTORE } from '../../app.config';
import { UserModel } from '../model/user.model';
import { AuthService } from './auth';

@Service()
/** Provides Firestore operations and reactive access to workspace users. */
export class UserService {
  private firestore = inject(FIREBASE_FIRESTORE);
  private authService = inject(AuthService);
  private unsubscribeUsers: (() => void) | undefined;

  /** All users in the workspace, kept in sync with Firestore. */
  users = signal<UserModel[]>([]);

  constructor() {
    effect(() => {
      const isLoggedIn = this.authService.currentUserId();

      this.unsubscribeUsers?.();
      this.unsubscribeUsers = undefined;

      if (!isLoggedIn) {
        this.users.set([]);
        return;
      }

      const usersRef = collection(this.firestore, 'users');
      this.unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
        this.users.set(snapshot.docs.map((doc) => doc.data() as UserModel));
      });
    });
  }

  /** Creates a user profile document in Firestore.
   *
   * @param uid The user's unique identifier (matches the Firebase Auth UID).
   * @param name The user's display name.
   * @param email The user's email address.
   * @param avatar The URL or path of the user's chosen avatar.
   * @returns A promise that resolves once the profile has been written.
   */
  async createUserProfile(uid: string, name: string, email: string, avatar: string) {
    const user: UserModel = {
      uid,
      name,
      email,
      avatar,
      status: 'online',
      channels: [],
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(this.firestore, 'users', uid), user);

    this.users.update((users) => (users.some((u) => u.uid === uid) ? users : [...users, user]));
  }

  /** Retrieves a single user profile from Firestore.
   *
   * @param uid The unique identifier of the user to retrieve.
   * @returns The user profile, or `undefined` if no profile exists for the given UID.
   */
  async getUserProfile(uid: string): Promise<UserModel | undefined> {
    const snapshot = await getDoc(doc(this.firestore, 'users', uid));
    return snapshot.exists() ? (snapshot.data() as UserModel) : undefined;
  }

  /** Returns the display name for a user ID from the currently loaded users, or a fallback. */
  getUserName(uid: string): string {
    return this.users().find((user) => user.uid === uid)?.name ?? 'Unbekannt';
  }

  async editUserName(userId: string, name: string) {
    const usersRef = doc(this.firestore, 'users', userId);
    await updateDoc(usersRef, {
      name: name,
    });
  }

  async editUserAvatar(userId: string, avatar: string) {
    const userRef = doc(this.firestore, 'users', userId);
    await updateDoc(userRef, {
      avatar: avatar,
    });
  }

  async deleteUserProfile(userId: string) {
    await deleteDoc(doc(this.firestore, 'users', userId));
  }

  /** Deletes every message and thread reply authored by the given user,
   * across all channels and direct-message conversations. */
  async deleteAllContentBySender(senderId: string): Promise<void> {
    const messagesQuery = query(
      collectionGroup(this.firestore, 'messages'),
      where('senderId', '==', senderId),
    );
    const threadQuery = query(
      collectionGroup(this.firestore, 'thread'),
      where('senderId', '==', senderId),
    );

    let messagesSnapshot;
    try {
      messagesSnapshot = await getDocs(messagesQuery);
      console.log('[Cleanup] messages found:', messagesSnapshot.size);
    } catch (error) {
      console.error('[Cleanup] messages query failed', error);
      throw error;
    }

    let threadSnapshot;
    try {
      threadSnapshot = await getDocs(threadQuery);
      console.log('[Cleanup] thread replies found:', threadSnapshot.size);
    } catch (error) {
      console.error('[Cleanup] thread query failed', error);
      throw error;
    }

    const batch = writeBatch(this.firestore);
    messagesSnapshot.docs.forEach((d) => {
      console.log('[Cleanup] deleting message at', d.ref.path);
      batch.delete(d.ref);
    });
    threadSnapshot.docs.forEach((d) => {
      console.log('[Cleanup] deleting thread reply at', d.ref.path);
      batch.delete(d.ref);
    });

    try {
      await batch.commit();
      console.log('[Cleanup] batch committed successfully');
    } catch (error) {
      console.error('[Cleanup] batch commit failed', error);
      throw error;
    }
  }
}
