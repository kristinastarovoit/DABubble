import { Service, inject } from '@angular/core';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { FIRESTORE } from '../../app.config';
import { UserModel } from '../model/user.model';

@Service()
export class UserService {
  private firestore = inject(FIRESTORE);

  createUserProfile(uid: string, name: string, email: string) {
    const user: UserModel = {
      uid,
      name,
      email,
      avatar: '',
      status: 'online',
      channels: [],
      createdAt: serverTimestamp(),
    };

    return setDoc(doc(this.firestore, 'users', uid), user);
  }
}
