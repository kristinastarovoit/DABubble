import { Service, inject, signal } from '@angular/core';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import { FIREBASE_FIRESTORE } from '../../app.config';
import { UserModel } from '../model/user.model';

@Service()
/** Provides Firestore operations and reactive access to workspace users. */
export class UserService {
  private firestore = inject(FIREBASE_FIRESTORE);

  /** All users in the workspace, kept in sync with Firestore. */
  users = signal<UserModel[]>([]);

  constructor() {
    const usersRef = collection(this.firestore, 'users');
    onSnapshot(usersRef, (snapshot) => {
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
  createUserProfile(uid: string, name: string, email: string, avatar: string) {
    const user: UserModel = {
      uid,
      name,
      email,
      avatar,
      status: 'online',
      channels: [],
      createdAt: serverTimestamp(),
    };

    return setDoc(doc(this.firestore, 'users', uid), user);
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
}
