import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, minLength, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';

import { AuthService } from '../../../shared/services/auth';
import { UserService } from '../../../shared/services/users';

interface SignupFormModel {
  name: string;
  email: string;
  password: string;
  acceptedPolicy: boolean;
}

@Component({
  imports: [FormField],
  selector: 'app-signup',
  styleUrl: './signup.scss',
  templateUrl: './signup.html',
})
export class Signup {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);

  protected readonly model = signal<SignupFormModel>({
    name: '',
    email: '',
    password: '',
    acceptedPolicy: false,
  });

  protected readonly signupForm = form(this.model, (f) => {
    required(f.name);
    required(f.email);
    email(f.email);
    required(f.password);
    minLength(f.password, 8);
    required(f.acceptedPolicy);
  });

  protected readonly isAvatar = signal(false);
  protected readonly selectedAvatar = signal('');
  protected readonly errorMessage = signal('');

  protected readonly avatar = [
    'app-icons/avatar_1.svg',
    'app-icons/avatar_2.svg',
    'app-icons/avatar_3.svg',
    'app-icons/avatar_4.svg',
    'app-icons/avatar_5.svg',
    'app-icons/avatar_6.svg',
  ];

  goToAvatarStep() {
    if (this.signupForm().invalid()) {
      return;
    }
    this.isAvatar.set(true);
  }

  goToLogin() {
    this.router.navigateByUrl('/login');
  }

  goBackToSignup() {
    this.isAvatar.set(false);
  }

  selectAvatar(avatar: string) {
    this.selectedAvatar.set(avatar);
  }

  async finishSignup() {
    if (!this.selectedAvatar()) {
      this.errorMessage.set('Bitte wähle einen Avatar aus.');
      return;
    }

    submit(this.signupForm, async () => {
      const { name, email, password } = this.model();
      this.errorMessage.set('');

      try {
        const credential = await this.authService.signup(email, password);
        await this.userService.createUserProfile(
          credential.user.uid,
          name,
          email,
          this.selectedAvatar(),
        );
        this.router.navigateByUrl('/login');
      } catch (err) {
        console.error('Signup error:', err);
        this.errorMessage.set('Registrierung fehlgeschlagen. Bitte versuch es erneut.');
      }
    });
  }
}
