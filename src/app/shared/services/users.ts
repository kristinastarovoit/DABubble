import { Service, effect, inject, signal } from '@angular/core';
import { collection, doc, getDoc, updateDoc, onSnapshot, serverTimestamp, setDoc, deleteDoc, query, collectionGroup, where, getDocs, writeBatch, arrayUnion, QuerySnapshot, DocumentData, WriteBatch} from 'firebase/firestore';
import { FIREBASE_FIRESTORE } from '../../app.config';
import { UserModel } from '../model/user.model';
import { AuthService } from './auth';

/** Provides Firestore operations and reactive access to workspace users. */
@Service()
export class UserService {
  /** Firestore instance used for user and channel operations. */
  private firestore = inject(FIREBASE_FIRESTORE);

  /** Provides the current authentication state. */
  private authService = inject(AuthService);

  /** Unsubscribes from the current users collection listener. */
  private unsubscribeUsers: (() => void) | undefined;

  /** All users in the workspace, kept in sync with Firestore. */
  users = signal<UserModel[]>([]);

  /** Starts and cleans up the users collection listener as authentication changes. */
  constructor() {
    effect(() => this.syncUsersForCurrentAuth());
  }

  /** Subscribes to the `users` collection while signed in, and clears it otherwise. */
  private syncUsersForCurrentAuth(): void {
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
    const user: UserModel = { uid, name, email, avatar, status: 'online', channels: [], createdAt: serverTimestamp() };
    await setDoc(doc(this.firestore, 'users', uid), user);

    this.users.update((users) => (users.some((u) => u.uid === uid) ? users : [...users, user]));

    await this.joinDefaultChannel(uid);
  }

  /** Adds a newly created user to the default "Allgemeines" channel, if it exists. */
  private async joinDefaultChannel(uid: string): Promise<void> {
    const channelsRef = collection(this.firestore, 'channels');
    const q = query(channelsRef, where('name', '==', 'Allgemeines'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.warn('[UserService] Default channel "Allgemeines" not found; skipping auto-join.');
      return;
    }

    const defaultChannel = snapshot.docs[0];
    await updateDoc(defaultChannel.ref, {
      memberIds: arrayUnion(uid),
    });
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

  /**
   * Updates a user's display name in Firestore.
   *
   * @param userId The ID of the user to update.
   * @param name The new display name.
   */
  async editUserName(userId: string, name: string) {
    const usersRef = doc(this.firestore, 'users', userId);
    await updateDoc(usersRef, {
      name: name,
    });
  }

  /**
   * Updates a user's avatar in Firestore.
   *
   * @param userId The ID of the user to update.
   * @param avatar The new avatar URL or path.
   */
  async editUserAvatar(userId: string, avatar: string) {
    const userRef = doc(this.firestore, 'users', userId);
    await updateDoc(userRef, {
      avatar: avatar,
    });
  }

  /**
   * Deletes a user's profile document from Firestore.
   *
   * @param userId The ID of the user whose profile should be deleted.
   */
  async deleteUserProfile(userId: string) {
    await deleteDoc(doc(this.firestore, 'users', userId));
  }

  /** Deletes every message and thread reply authored by the given user,
   * across all channels and direct-message conversations. */
  async deleteAllContentBySender(senderId: string): Promise<void> {
    const messagesSnapshot = await this.queryContentBySender('messages', senderId);
    const threadSnapshot = await this.queryContentBySender('thread', senderId);
    const batch = writeBatch(this.firestore);
    messagesSnapshot.docs.forEach((d) => batch.delete(d.ref));
    threadSnapshot.docs.forEach((d) => batch.delete(d.ref));
    await this.commitCleanupBatch(batch);
  }

  /** Finds every document in the given collection group authored by `senderId`. */
  private async queryContentBySender(
    collectionId: string,
    senderId: string,
  ): Promise<QuerySnapshot<DocumentData>> {
    const q = query(collectionGroup(this.firestore, collectionId), where('senderId', '==', senderId));
    try {
      return await getDocs(q);
    } catch (error) {
      console.error(`[Cleanup] ${collectionId} query failed`, error);
      throw error;
    }
  }

  /** Commits a batch that deletes the user's authored content. */
  private async commitCleanupBatch(batch: WriteBatch): Promise<void> {
    try {
      await batch.commit();
    } catch (error) {
      console.error('[Cleanup] batch commit failed', error);
      throw error;
    }
  }
}
