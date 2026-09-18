import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-edit-channel',
  styleUrl: './edit-channel.scss',
  templateUrl: './edit-channel.html',
})
export class EditChannel {
  /** Current channel name. */
  @Input() channelName = '';
  /** Current channel description. */
  @Input() description = '';
  /** Display name of the channel creator. */
  @Input() createdByName = '';
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

  /** Current channel name shown in the view. */
  name = '';
  /** Draft value while editing the name. */
  editedName = '';
  /** Validation error message for the name field. */
  nameErrorMessage = '';

  /** Draft value while editing the description. */
  editedDescription = '';

  /** Initializes the view name from the input. */
  ngOnInit(): void {
    this.name = this.channelName;
  }

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
    this.editedName = this.name;
    this.nameErrorMessage = '';
    this.isEditingName = true;
  }

  /** Validates and saves the edited channel name. */
  saveName(): void {
    this.nameErrorMessage = '';
    const trimmed = this.editedName.trim();
    const otherNames = this.existingChannelNames.filter(n => n !== this.name);

    if (!trimmed) {
      this.nameErrorMessage = 'Der Channel-Name darf nicht leer sein.';
      return;
    }
    if (otherNames.includes(trimmed)) {
      this.nameErrorMessage = 'Ein Channel mit diesem Namen existiert bereits.';
      return;
    }

    this.name = trimmed;
    this.isEditingName = false;
    this.nameUpdated.emit(trimmed);
  }

  /** Enters edit mode for the channel description. */
  startEditingDescription(): void {
    this.editedDescription = this.description;
    this.isEditingDescription = true;
  }

  /** Saves the edited channel description. */
  saveDescription(): void {
    this.description = this.editedDescription.trim();
    this.isEditingDescription = false;
    this.descriptionUpdated.emit(this.description);
  }

  /** Emits the leave event and closes the dialog. */
  leaveChannel(): void {
    this.left.emit();
    this.close();
  }

  /** Closes the dialog only when the backdrop itself (not the card) was clicked. */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef.nativeElement) {
      this.close();
    }
  }
}
