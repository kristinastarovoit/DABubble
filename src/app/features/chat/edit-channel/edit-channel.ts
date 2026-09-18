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
  @Input() channelName = '';
  @Input() description = '';
  @Input() createdByName = '';
  @Input() existingChannelNames: string[] = [];

  @Output() nameUpdated = new EventEmitter<string>();
  @Output() descriptionUpdated = new EventEmitter<string>();
  @Output() left = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialogRef') private dialogRef!: ElementRef<HTMLDialogElement>;

  isEditingName = false;
  isEditingDescription = false;

  name = '';
  editedName = '';
  nameErrorMessage = '';

  editedDescription = '';

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

  startEditingName(): void {
    this.editedName = this.name;
    this.nameErrorMessage = '';
    this.isEditingName = true;
  }

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

  cancelEditingName(): void {
    this.isEditingName = false;
  }

  startEditingDescription(): void {
    this.editedDescription = this.description;
    this.isEditingDescription = true;
  }

  saveDescription(): void {
    this.description = this.editedDescription.trim();
    this.isEditingDescription = false;
    this.descriptionUpdated.emit(this.description);
  }

  cancelEditingDescription(): void {
    this.isEditingDescription = false;
  }

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
