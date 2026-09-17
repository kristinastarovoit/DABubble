import { Service, inject, signal } from '@angular/core';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import { FIREBASE_FIRESTORE } from '../../app.config';
import { UserModel } from '../model/user.model';

@Service()
/** Provides Firestore operations and reactive user-profile data. */
export class UserService {
  private firestore = inject(FIREBASE_FIRESTORE);

  /** Reads all user profiles from Firestore.
   *
   * @returns A signal containing the user profiles and a function that removes the listener.
   */
  getUsers(): { users: ReturnType<typeof signal<UserModel[]>>; unsubscribe: () => void } {
    const users = signal<UserModel[]>([]);
    const unsubscribe = onSnapshot(collection(this.firestore, 'users'), (snapshot) => {
      users.set(snapshot.docs.map((userDocument) => userDocument.data() as UserModel));
    });
    return { users, unsubscribe };
  }

  /** Creates or overwrites the profile for a user.
   *
   * @param uid The unique identifier of the user.
   * @param name The display name of the user.
   * @param email The email address of the user.
   * @param avatar The avatar URL of the user.
   * @returns A promise that resolves when the profile has been written.
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
}
