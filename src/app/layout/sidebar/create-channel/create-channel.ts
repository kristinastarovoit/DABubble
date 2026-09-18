import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-create-channel',
  styleUrl: './create-channel.scss',
  templateUrl: './create-channel.html',
})
export class CreateChannel {

  @Input() existingChannelNames: string[] = [];

  @Output() created = new EventEmitter<{ name: string; description: string }>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('dialogRef') private dialogRef!: ElementRef<HTMLDialogElement>;

  name = '';
  description = '';
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

  private resetForm(): void {
    this.name = '';
    this.description = '';
    this.errorMessage = '';
  }
}
