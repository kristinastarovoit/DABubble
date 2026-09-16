import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
      // Code ungültig/abgelaufen, isCodeValid bleibt false
    } finally {
      this.isVerifying.set(false);
    }
  }

  protected model = signal({ password: '', passwordConfirm: '' });

  protected resetForm = form(this.model, (schemaPath) => {
    required(schemaPath.password, { message: 'Bitte geben Sie ein neues Passwort ein.' });
    minLength(schemaPath.password, 8, {
      message: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
    });

    required(schemaPath.passwordConfirm, { message: 'Bitte bestätigen Sie Ihr Passwort.' });
    validate(schemaPath.passwordConfirm, ({ value, valueOf, stateOf }) => {
      if (!stateOf(schemaPath.password).touched()) return null;
      if (value() !== valueOf(schemaPath.password)) {
        return { kind: 'passwordMismatch', message: 'Die Passwörter stimmen nicht überein.' };
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
      this.errorMessage.set(
        'Passwort konnte nicht geändert werden. Bitte fordern Sie einen neuen Link an.',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
