import { Component } from '@angular/core';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {

  protected model = signal({ email: '', password: '' });

  protected loginForm = form(this.model, (schemaPath) => {
    required(schemaPath.email, { message: '*Please enter your email address.' });
    email(schemaPath.email, { message: '*Please enter a valid email address.' });

    required(schemaPath.password, { message: 'Please enter your password.' });
  });

  protected isSubmitting = signal(false);
  protected errorMessage = signal<string | null>(null);

  protected async onSubmit() {
    if (this.loginForm().invalid()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      await this.authService.login(this.model().email, this.model().password);
      this.router.navigateByUrl('/dashboard');
    } catch {
      this.errorMessage.set('Email or password is incorrect. Please try again');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected isGuestLoggingIn = signal(false);

  protected async loginAsGuest() {
    this.isGuestLoggingIn.set(true);
    this.errorMessage.set(null);

    try {
      const credential = await this.authService.loginAsGuest();
      await this.userService.createUserProfile(
        credential.user.uid,
        'Guest',
        `guest-${credential.user.uid}@dabubble.local`,
        'app-icons/avatar_default.svg',
      );
      this.router.navigateByUrl('/dashboard'); // TODO: your actual route
    } catch {
      this.errorMessage.set('Guest login failed. Please try again.');
    } finally {
      this.isGuestLoggingIn.set(false);
    }
  }

  protected isGoogleLoggingIn = signal(false);

  protected async loginWithGoogle() {
    this.isGoogleLoggingIn.set(true);
    this.errorMessage.set(null);

    try {
      const credential = await this.authService.loginWithGoogle();
      const { creationTime, lastSignInTime } = credential.user.metadata;
      const isNewUser = creationTime === lastSignInTime;

      if (isNewUser) {
        await this.userService.createUserProfile(
          credential.user.uid,
          credential.user.displayName ?? 'DABubble User',
          credential.user.email ?? '',
          credential.user.photoURL ?? 'app-icons/avatar_default.svg',
        );
      }

      this.router.navigateByUrl('/dashboard');
    } catch {
      this.errorMessage.set('Google login failed. Please try again.');
    } finally {
      this.isGoogleLoggingIn.set(false);
    }
  }
}
