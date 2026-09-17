import { Service, inject } from '@angular/core';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { FIREBASE_FIRESTORE } from '../../app.config';
import { UserModel } from '../model/user.model';

@Service()
export class UserService {
  private firestore = inject(FIREBASE_FIRESTORE);

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

  async getUserProfile(uid: string): Promise<UserModel | undefined> {
    const snapshot = await getDoc(doc(this.firestore, 'users', uid));
    return snapshot.exists() ? (snapshot.data() as UserModel) : undefined;
  }
}
