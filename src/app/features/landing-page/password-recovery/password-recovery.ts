import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, required } from '@angular/forms/signals';
import { AuthService } from '../../../shared/services/auth';
import { Toast } from '../../../shared/components/toast/toast';
import { Router } from '@angular/router';

@Component({
  imports: [FormField, Toast],
  selector: 'app-password-recovery',
  styleUrl: './password-recovery.scss',
  templateUrl: './password-recovery.html',
})
export class PasswordRecovery {
  protected model = signal({ email: '' });
  private authService = inject(AuthService);
  private router = inject(Router);

  protected recoveryForm = form(this.model, (schemaPath) => {
    required(schemaPath.email, { message: 'Please enter your email address.' });
    email(schemaPath.email, { message: 'Please enter a valid email address.' });
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
        this.errorMessage.set('Something went wrong. Please try again later.');
      }
    } finally {
      this.isSubmitting.set(false);
      this.wasSent.set(true);
    }
  }

  goToLogin() {
    this.router.navigateByUrl('/login');
  }
}
