import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChannelService } from '../../../shared/services/channel-service';

@Component({
  imports: [FormsModule],
  selector: 'app-edit-channel',
  styleUrl: './edit-channel.scss',
  templateUrl: './edit-channel.html',
})
export class EditChannel {
  /** Names of channels already in use, used for duplicate validation. */
  @Input() existingChannelNames: string[] = [];

  /** Emitted when the channel name is saved. */
  @Output() nameUpdated = new EventEmitter<string>();

  /** Emitted when the channel description is saved. */
  @Output() descriptionUpdated = new EventEmitter<string>();

  /** Emitted when the user leaves the channel. */
  @Output() left = new EventEmitter<void>();

  /** Emitted when the dialog is closed. */
  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialogRef') private dialogRef!: ElementRef<HTMLDialogElement>;

  /** Whether the name field is in edit mode. */
  isEditingName = false;
  /** Whether the description field is in edit mode. */
  isEditingDescription = false;

  /** Draft value while editing the name. */
  editedName = '';
  /** Validation error message for the name field. */
  nameErrorMessage = '';

  /** Draft value while editing the description. */
  editedDescription = '';

  /** Provides the available channels and channel selection state. */
  channelService = inject(ChannelService);

/** The currently active channel. */
  activeChannel = computed(() =>
    this.channelService.channels().find(channel => channel.id === this.channelId())
  );

/** The ID of the currently active channel. */
  channelId = computed(() => this.channelService.activeChannelId());

  /** Opens the dialog as a modal. */
  open(): void {
    this.dialogRef.nativeElement.showModal();
  }

  /** Closes the dialog and discards unsaved edits. */
  close(): void {
    this.dialogRef.nativeElement.close();
    this.isEditingName = false;
    this.isEditingDescription = false;
    this.closed.emit();
  }

  /** Enters edit mode for the channel name. */
  startEditingName(): void {
    this.editedName = this.activeChannel()?.name ?? '';
    this.nameErrorMessage = '';
    this.isEditingName = true;
  }

  /** Validates and saves the edited channel name. */
  async saveName(): Promise<void> {
    const channel = this.activeChannel();
    if (!channel) return;

    this.nameErrorMessage = '';
    const trimmed = this.editedName.trim();
    const otherNames = this.existingChannelNames.filter(n => n !== channel.name);

    if (!trimmed) {
      this.nameErrorMessage = 'The Channel name must not be empty';
      return;
    }
    if (otherNames.includes(trimmed)) {
      this.nameErrorMessage = 'A Channel with this name already exists.';
      return;
    }

    await this.channelService.editChannelName(trimmed, channel.id);
    this.isEditingName = false;
    this.nameUpdated.emit(trimmed);
  }

  /** Enters edit mode for the channel description. */
  startEditingDescription(): void {
    this.editedDescription = this.activeChannel()?.description ?? '';
    this.isEditingDescription = true;
  }

  /** Saves the edited channel description. */
  async saveDescription(): Promise<void> {
    const channel = this.activeChannel();
    if (!channel) return;
    const description = this.editedDescription.trim();
    await this.channelService.editChannelDescription(
      description,
      channel.id
    );
    this.isEditingDescription = false;
  }

  /** Leaves the currently active channel. */
  leaveChannel(): void {
    const channelId = this.channelId();
    if (!channelId) return; 
    this.channelService.leaveChannel(channelId);
    this.close();
  }

  /** Closes the dialog only when the backdrop itself (not the card) was clicked. */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef.nativeElement) {
      this.close();
    }
  }
}
