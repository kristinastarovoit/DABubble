import { Component, inject, signal } from '@angular/core';
import { FieldContext, form, FormField, minLength, required, submit, validate} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../shared/services/auth';
import { UserService } from '../../../shared/services/users';
import { Toast } from '../../../shared/components/toast/toast';

/** Values collected by the signup form before creating an account. */
interface SignupFormModel {
  name: string;
  email: string;
  password: string;
  acceptedPolicy: boolean;
}

/** Requires a proper domain with a dot and a top-level part of at least two characters. */
const emailDomainPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validates that the email has a real domain, not just a single character after the @. */
function emailDomain(ctx: FieldContext<string>) {
  const isValid = emailDomainPattern.test(ctx.value());
  return isValid ? null : { kind: 'emailDomain', message: 'Please enter a valid email address.' };
}

/** Validates that the name contains at least two parts made of letters, apostrophes, or hyphens. */
function fullName(ctx: FieldContext<string>) {
  const parts = ctx.value().trim().split(/\s+/).filter(Boolean);
  const onlyLetters = /^[\p{L}'-]+$/u;
  const isValid = parts.length >= 2 && parts.every((p) => onlyLetters.test(p));
  return isValid ? null : { kind: 'fullName', message: 'Please enter your first and last name.' };
}

/** Collects signup details, lets users choose an avatar, and creates their account. */
@Component({
  imports: [FormField, Toast, RouterLink],
  selector: 'app-signup',
  styleUrl: './signup.scss',
  templateUrl: './signup.html',
})
export class Signup {
  /** Provides account creation operations. */
  private authService = inject(AuthService);

  /** Creates and retrieves user profiles. */
  private userService = inject(UserService);

  /** Navigates between signup and login views. */
  private router = inject(Router);

  /** Holds the user's signup details and policy acceptance state. */
  protected readonly model = signal<SignupFormModel>({
    name: '',
    email: '',
    password: '',
    acceptedPolicy: false,
  });

  /** Validates the signup details and policy acceptance. */
  protected readonly signupForm = form(this.model, (f) => {
    required(f.name);
    validate(f.name, fullName);
    required(f.email);
    validate(f.email, emailDomain);
    required(f.password);
    minLength(f.password, 8);
    required(f.acceptedPolicy);
  });

  /** Indicates whether the avatar-selection step is currently displayed. */
  protected readonly isAvatar = signal(false);

  /** Path of the avatar selected for the new account. */
  protected readonly selectedAvatar = signal('');

  /** Current signup error message, or an empty string when there is no error. */
  protected readonly errorMessage = signal('');

  /** Indicates that the account and profile were successfully created. */
  protected readonly accountCreated = signal(false);

  /** Avatar image paths available for new accounts. */
  protected readonly avatar = [
    'app-icons/avatar_1.svg',
    'app-icons/avatar_2.svg',
    'app-icons/avatar_3.svg',
    'app-icons/avatar_4.svg',
    'app-icons/avatar_5.svg',
    'app-icons/avatar_6.svg',
  ];

  /** Validates the signup form and advances to avatar selection. */
  goToAvatarStep() {
    if (this.signupForm().invalid()) {
      return;
    }
    this.isAvatar.set(true);
  }

  /** Navigates to the login page. */
  goToLogin() {
    this.router.navigateByUrl('/login');
  }

  /** Returns from avatar selection to the signup form. */
  goBackToSignup() {
    this.isAvatar.set(false);
  }

  /**
   * Selects an avatar for the new account.
   *
   * @param avatar The path of the selected avatar image.
   */
  selectAvatar(avatar: string) {
    this.selectedAvatar.set(avatar);
  }

  /** Checks the avatar selection and submits the form to create the account. */
  async finishSignup(): Promise<void> {
    if (!this.selectedAvatar()) {
      this.errorMessage.set('Please choose an avatar.');
      return;
    }
    submit(this.signupForm, () => this.createAccount());
  }

  /** Creates the Firebase account and user profile for the current form values. */
  private async createAccount(): Promise<void> {
    const { name, email, password } = this.model();
    this.errorMessage.set('');
    try {
      const credential = await this.authService.signup(email, password);
      await this.userService.createUserProfile(credential.user.uid, name, email, this.selectedAvatar());
      this.accountCreated.set(true);
    } catch (err) {
      console.error('Signup error:', err);
      this.errorMessage.set('Registration failed. Please try again.');
    }
  }
}
