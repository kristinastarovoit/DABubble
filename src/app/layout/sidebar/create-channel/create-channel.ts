import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  imports: [FormsModule],
  selector: 'app-create-channel',
  styleUrl: './create-channel.scss',
  templateUrl: './create-channel.html',
})
export class CreateChannel {

  /** Names of channels already in use, used for duplicate validation. */
  @Input() existingChannelNames: string[] = [];

  /** Emitted when a new channel is created. */
  @Output() created = new EventEmitter<{ name: string; description: string }>();
  /** Emitted when creation is cancelled. */
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('dialogRef') private dialogRef!: ElementRef<HTMLDialogElement>;

  /** Entered channel name. */
  name = '';
  /** Entered channel description. */
  description = '';
  /** Validation error message shown to the user. */
  errorMessage = '';

  /** Opens the dialog as a modal. */
  open(): void {
    this.dialogRef.nativeElement.showModal();
  }

  /** Closes the dialog and clears the form. */
  close(): void {
    this.dialogRef.nativeElement.close();
    this.resetForm();
  }

  /** Validates and emits the new channel, then closes the dialog. */
  submit(): void {
    this.errorMessage = '';
    const trimmedName = this.name.trim();

    if (!trimmedName) {
      this.errorMessage = 'Bitte einen Channel-Namen eingeben.';
      return;
    }
    if (this.existingChannelNames.includes(trimmedName)) {
      this.errorMessage = 'Ein Channel mit diesem Namen existiert bereits.';
      return;
    }

    this.created.emit({ name: trimmedName, description: this.description.trim() });
    this.close();
  }

  /** Cancels creation and closes the dialog. */
  cancel(): void {
    this.cancelled.emit();
    this.close();
  }

  /** Closes the dialog only when the backdrop itself (not the card) was clicked. */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef.nativeElement) {
      this.cancel();
    }
  }

  /** Clears all form fields and the error message. */
  private resetForm(): void {
    this.name = '';
    this.description = '';
    this.errorMessage = '';
  }
}
