import { Service, inject } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from 'firebase/auth';

import { FIREBASE_AUTH } from '../../app.config';

@Service()
export class AuthService {
  private auth = inject(FIREBASE_AUTH);

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  signup(email: string, password: string) {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  resetPassword(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }

  verifyResetCode(oobCode: string) {
    return verifyPasswordResetCode(this.auth, oobCode);
  }

  confirmResetCode(oobCode: string, newPassword: string) {
    return confirmPasswordReset(this.auth, oobCode, newPassword);
  }

  logout() {
    return signOut(this.auth);
  }
}
