import { Component, ElementRef, EventEmitter, Output, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChannelService } from '../../../shared/services/channel-service';

@Component({
  imports: [FormsModule],
  selector: 'app-create-channel',
  styleUrl: './create-channel.scss',
  templateUrl: './create-channel.html',
})
export class CreateChannel {
  /** Emitted when creation is cancelled. */
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('dialogRef') private dialogRef!: ElementRef<HTMLDialogElement>;

  /** Entered channel name. */
  name = '';

  /** Entered channel description. */
  description = '';

  /** Validation error message shown to the user. */
  errorMessage = '';

  /** Provides the available channels and channel selection state. */
  channelService = inject(ChannelService);

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
  async submit(): Promise<void> {
    this.errorMessage = '';
    const trimmedName = this.name.trim();
    if (!trimmedName) {
      this.errorMessage = 'Please enter a channel name.';
      return;
    }
    const channelId = await this.channelService.addChannel(
      trimmedName,
      this.description.trim()
    );
    if (!channelId) {
      this.errorMessage = 'A channel with this name already exists.';
      return;
    }
    this.channelService.selectChannel(channelId);
    this.channelService.pendingAddMembersChannelId.set(channelId);
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
