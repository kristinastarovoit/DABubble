import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { User } from 'firebase/auth';
import { AuthService } from '../../../shared/services/auth';
import { UserService } from '../../../shared/services/users';
import { email, form, FormField, required } from '@angular/forms/signals';

/** Handles email, guest, and Google sign-in. */
@Component({
  selector: 'app-login',
  imports: [RouterLink, FormField],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  /** Provides authentication operations. */
  private authService = inject(AuthService);

  /** Provides access to user profiles. */
  private userService = inject(UserService);

  /** Navigates to the dashboard after a successful sign-in. */
  private router = inject(Router);

  /** Holds the email and password entered in the login form. */
  protected model = signal({ email: '', password: '' });

  /** Validates the email and password fields in the login form. */
  protected loginForm = form(this.model, (schemaPath) => {
    required(schemaPath.email, { message: '*Please enter your email address.' });
    email(schemaPath.email, { message: '*Please enter a valid email address.' });

    required(schemaPath.password, { message: 'Please enter your password.' });
  });

  /** Indicates that an email sign-in request is in progress. */
  protected isSubmitting = signal(false);

  /** Current login error message, or `null` when no error is displayed. */
  protected errorMessage = signal<string | null>(null);

  /** Indicates that a guest sign-in request is in progress. */
  protected isGuestLoggingIn = signal(false);

  /** Validates and submits the email login form. */
  protected async onSubmit(): Promise<void> {
    if (this.loginForm().invalid()) return;
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    try {
      const credential = await this.authService.login(this.model().email, this.model().password);
      if (!(await this.ensureProfileExists(credential.user.uid))) return;
      this.router.navigateByUrl('/dashboard');
    } catch {
      this.errorMessage.set('Email or password is incorrect. Please try again');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /** Signs the user back out and reports an error if no profile exists for them. */
  private async ensureProfileExists(uid: string): Promise<boolean> {
    if (await this.userService.getUserProfile(uid)) return true;
    await this.authService.logout();
    this.errorMessage.set('No user profile found for this account. Please sign up again.');
    return false;
  }

  /** Signs in as a guest and creates a guest profile before navigating to the dashboard. */
  protected async loginAsGuest(): Promise<void> {
    this.isGuestLoggingIn.set(true);
    this.errorMessage.set(null);
    try {
      const credential = await this.authService.loginAsGuest();
      await credential.user.getIdToken(); // Ensure the authentication token is ready.
      const avatar = 'app-icons/avatar_default.svg';
      await this.userService.createUserProfile(credential.user.uid, 'Guest', this.generateGuestEmail(), avatar);
      this.router.navigateByUrl('/dashboard');
    } catch {
      this.errorMessage.set('Guest login failed. Please try again.');
    } finally {
      this.isGuestLoggingIn.set(false);
    }
  }

  /** Indicates that a Google sign-in request is in progress. */
  protected isGoogleLoggingIn = signal(false);

  /** Signs in with Google and creates a profile for a first-time user. */
  protected async loginWithGoogle(): Promise<void> {
    this.isGoogleLoggingIn.set(true);
    this.errorMessage.set(null);
    try {
      const credential = await this.authService.loginWithGoogle();
      await this.createProfileIfNewUser(credential.user);
      this.router.navigateByUrl('/dashboard');
    } catch {
      this.errorMessage.set('Google login failed. Please try again.');
    } finally {
      this.isGoogleLoggingIn.set(false);
    }
  }

  /** Creates a user profile the first time a Google account signs in. */
  private async createProfileIfNewUser(user: User): Promise<void> {
    const { creationTime, lastSignInTime } = user.metadata;
    if (creationTime !== lastSignInTime) return;
    await this.userService.createUserProfile(
      user.uid,
      user.displayName ?? 'DABubble User',
      user.email ?? '',
      user.photoURL ?? 'app-icons/avatar_default.svg',
    );
  }

  /** Generates a short, human-friendlier placeholder email for guest accounts. */
  private generateGuestEmail(): string {
    const randomNumber = Math.floor(1000 + Math.random() * 9000); // Four-digit number from 1000 to 9999.
    return `guest${randomNumber}@dabubble.de`;
  }
}
