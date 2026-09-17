import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../shared/services/auth';
import { form, FormField, minLength, required, validate } from '@angular/forms/signals';
import { Toast } from '../../../shared/components/toast/toast';

@Component({
  imports: [FormField, Toast],
  selector: 'app-password-reset',
  styleUrl: './password-reset.scss',
  templateUrl: './password-reset.html',
})
export class PasswordReset implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private oobCode = '';

  protected isVerifying = signal(true);
  protected isCodeValid = signal(false);

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
      // Code invalid/expired, isCodeValid stays false
    } finally {
      this.isVerifying.set(false);
    }
  }

  protected model = signal({ password: '', passwordConfirm: '' });

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

  protected isSubmitting = signal(false);
  protected errorMessage = signal<string | null>(null);
  protected wasReset = signal(false);

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

  goToLogin() {
    this.router.navigateByUrl('/login');
  }
}
