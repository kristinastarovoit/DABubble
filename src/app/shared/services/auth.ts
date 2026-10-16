import { Service, effect, inject, signal } from '@angular/core';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, verifyPasswordResetCode, confirmPasswordReset, signInAnonymously, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, deleteUser} from 'firebase/auth';
import { FIREBASE_AUTH } from '../../app.config';

/** Provides Firebase authentication operations and reactive authentication state. */
@Service()
export class AuthService {
  /** Firebase Authentication instance. */
  private auth = inject(FIREBASE_AUTH);

  /** UID of the currently authenticated user, or `undefined` when logged out. */
  currentUserId = signal<string | undefined>(undefined);

  /** Whether the initial Firebase authentication state has been resolved. */
  isAuthReady = signal(false);

  /** Subscribes to Firebase authentication state and updates the reactive auth signals. */
  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUserId.set(user?.uid);
      this.isAuthReady.set(true);
    });
  }

  /** Resolves when the initial Firebase authentication state is ready. */
  waitUntilReady(): Promise<void> {
    if (this.isAuthReady()) return Promise.resolve();

    return new Promise((resolve) => {
      const ref = effect(() => {
        if (this.isAuthReady()) {
          ref.destroy();
          resolve();
        }
      });
    });
  }

  /**
   * Signs in with an email address and password.
   *
   * @param email The account email address.
   * @param password The account password.
   * @returns The Firebase authentication credential.
   */
  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  /**
   * Creates an account with an email address and password.
   *
   * @param email The account email address.
   * @param password The account password.
   * @returns The Firebase authentication credential.
   */
  signup(email: string, password: string) {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  /**
   * Sends a password-reset email.
   *
   * @param email The email address associated with the account.
   */
  resetPassword(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }

  /**
   * Verifies a password-reset action code.
   *
   * @param oobCode The action code from the password-reset link.
   * @returns The email address associated with the reset code.
   */
  verifyResetCode(oobCode: string) {
    return verifyPasswordResetCode(this.auth, oobCode);
  }

  /**
   * Confirms a password-reset code and sets the new password.
   *
   * @param oobCode The action code from the password-reset link.
   * @param newPassword The new password to set.
   */
  confirmResetCode(oobCode: string, newPassword: string) {
    return confirmPasswordReset(this.auth, oobCode, newPassword);
  }

  /** Signs out the current user. */
  logout() {
    return signOut(this.auth);
  }

  /** Signs in anonymously. */
  loginAsGuest() {
    return signInAnonymously(this.auth);
  }

  /** Whether the currently authenticated user is anonymous. */
  get isCurrentUserAnonymous(): boolean {
    return this.auth.currentUser?.isAnonymous ?? false;
  }

  /** Deletes the currently authenticated Firebase user, if one exists. */
  deleteCurrentUser() {
    if (!this.auth.currentUser) return Promise.resolve();
    return deleteUser(this.auth.currentUser);
  }

  /** Opens the Google sign-in popup. */
  loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider);
  }
}
