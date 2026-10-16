import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth';
import { form, FormField, minLength, required, validate } from '@angular/forms/signals';
import { Toast } from '../../../shared/components/toast/toast';

/** Verifies password-reset links and lets users choose a new password. */
@Component({
  imports: [FormField, Toast],
  selector: 'app-password-reset',
  styleUrl: './password-reset.scss',
  templateUrl: './password-reset.html',
})
export class PasswordReset implements OnInit {
  /** Provides password-reset operations. */
  private authService = inject(AuthService);

  /** Provides the password-reset code from the current URL. */
  private route = inject(ActivatedRoute);

  /** Navigates back to the login page after the password is reset. */
  private router = inject(Router);

  /** Password-reset action code supplied by the reset link. */
  private oobCode = '';

  /** Indicates whether the reset code is being verified. */
  protected isVerifying = signal(true);

  /** Indicates whether the reset code is valid and can be used. */
  protected isCodeValid = signal(false);

  /** Holds the new password and its confirmation. */
  protected model = signal({ password: '', passwordConfirm: '' });

  /** Indicates whether a password-reset request is in progress. */
  protected isSubmitting = signal(false);

  /** Current password-reset error message, or `null` when no error is displayed. */
  protected errorMessage = signal<string | null>(null);

  /** Indicates that the password was successfully reset. */
  protected wasReset = signal(false);

  /** Reads and verifies the reset code from the URL when the component initializes. */
  async ngOnInit() {
    this.oobCode = this.route.snapshot.queryParamMap.get('oobCode') ?? '';
    if (!this.oobCode) {
      this.isVerifying.set(false);
      return;
    }
    try {
      await this.authService.verifyResetCode(this.oobCode);
      this.isCodeValid.set(true);
    } catch {
    } finally {
      this.isVerifying.set(false);
    }
  }

  /** Validates the new password and ensures its confirmation matches. */
  protected resetForm = form(this.model, (schemaPath) => {
    required(schemaPath.password, { message: 'Please enter a new password.' });
    minLength(schemaPath.password, 8, {
      message: 'The password must be at least 8 characters long.',
    });
    required(schemaPath.passwordConfirm, { message: 'Please confirm your password.' });
    validate(schemaPath.passwordConfirm, ({ value, valueOf, stateOf }) => {
      if (!stateOf(schemaPath.password).touched()) return null;
      if (value() !== valueOf(schemaPath.password)) {
        return { kind: 'passwordMismatch', message: 'The passwords do not match.' };
      }
      return null;
    });
  });

  /** Confirms the reset code and submits the new password. */
  protected async onSubmit() {
    if (this.resetForm().invalid()) return;
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.authService.confirmResetCode(this.oobCode, this.model().password);
      this.wasReset.set(true);
    } catch {
      this.errorMessage.set('Password could not be changed. Please request a new link.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /** Navigates to the login page. */
  goToLogin() {
    this.router.navigateByUrl('/login');
  }
}
