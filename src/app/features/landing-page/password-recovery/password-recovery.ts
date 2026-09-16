import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, required } from '@angular/forms/signals';
import { AuthService } from '../../../shared/services/auth';

@Component({
  imports: [FormField],
  selector: 'app-password-recovery',
  styleUrl: './password-recovery.scss',
  templateUrl: './password-recovery.html',
})
export class PasswordRecovery {
  protected model = signal({ email: '' });
  private authService = inject(AuthService);

  protected recoveryForm = form(this.model, (schemaPath) => {
    required(schemaPath.email, { message: 'Bitte geben Sie Ihre E-Mail-Adresse ein.' });
    email(schemaPath.email, { message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' });
  });

  protected isSubmitting = signal(false);
  protected wasSent = signal(false);
  protected errorMessage = signal<string | null>(null);

  protected async onSubmit() {
    if (this.recoveryForm().invalid()) return;

    this.isSubmitting.set(true);

    try {
      await this.authService.resetPassword(this.model().email);
      this.wasSent.set(true);
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/user-not-found') {
        this.wasSent.set(true);
      } else {
        this.errorMessage.set('Etwas ist schiefgelaufen. Bitte versuchen Sie es später erneut.');
      }
    } finally {
      this.isSubmitting.set(false);
      this.wasSent.set(true);
    }
  }
}
