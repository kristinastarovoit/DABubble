import { Component, ElementRef, EventEmitter, Output, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChannelService } from '../../../shared/services/channel-service';
import { DmService } from '../../../shared/services/dm-service';
import { AuthService } from '../../../shared/services/auth';
import { UserModel } from '../../../shared/model/user.model';

@Component({
  imports: [FormsModule, CommonModule],
  selector: 'app-create-channel',
  styleUrl: './create-channel.scss',
  templateUrl: './create-channel.html',
})
export class CreateChannel {
  /** Emitted when creation is cancelled. */
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('dialogRef') private dialogRef!: ElementRef<HTMLDialogElement>;
  @ViewChild('membersDialogRef') private membersDialogRef!: ElementRef<HTMLDialogElement>;

  /** Entered channel name. */
  name = '';

  /** Entered channel description. */
  description = '';

  /** Validation error message shown to the user. */
  errorMessage = '';

  /** Provides the available channels and channel selection state. */
  channelService = inject(ChannelService);

  /** Provides direct-message data, used as the source of "contacts". */
  private dmService = inject(DmService);

  /** Provides reactive authentication state. */
  private authService = inject(AuthService);

  /** Which member option is currently selected in the second step. */
  memberOption = signal<'all' | 'specific'>('all');

  /** Text entered in the "Enter name" search field. */
  memberQuery = '';

  /** Members chosen via the search field. */
  selectedMembers = signal<UserModel[]>([]);

  /** Validation or persistence error shown in the second step. */
  membersError = '';

  /** All users eligible as "contacts", excluding the signed-in user. */
  private contactUsers = computed(() =>
    this.dmService
      .dmPartners()
      .filter((partner) => !partner.isSelf)
      .map((partner) => partner.user),
  );

  /** Contacts matching the current search query that have not been selected yet. */
  get memberSuggestions(): UserModel[] {
    const query = this.memberQuery.trim().toLowerCase();
    if (!query) return [];

    const selectedIds = this.selectedMembers().map((user) => user.uid);
    return this.contactUsers().filter(
      (user) => !selectedIds.includes(user.uid) && user.name.toLowerCase().includes(query),
    );
  }

  /** Opens the dialog as a modal. */
  open(): void {
    this.dialogRef.nativeElement.showModal();
  }

  /** Closes the dialog and clears the form. */
  close(): void {
    this.dialogRef.nativeElement.close();
    this.resetForm();
  }

  /** Validates the channel name and advances to the member-selection step. */
  async submit(): Promise<void> {
    this.errorMessage = '';
    const trimmedName = this.name.trim();
    if (!trimmedName) {
      this.errorMessage = 'Please enter a channel name.';
      return;
    }

    if (await this.channelService.channelNameExists(trimmedName)) {
      this.errorMessage = 'A channel with this name already exists.';
      return;
    }

    this.dialogRef.nativeElement.close();
    this.membersDialogRef.nativeElement.showModal();
  }

  /** Adds a searched contact to the selected-members list. */
  selectMember(user: UserModel): void {
    this.selectedMembers.update((members) => [...members, user]);
    this.memberQuery = '';
  }

  /** Removes a previously selected member. */
  removeMember(userId: string): void {
    this.selectedMembers.update((members) => members.filter((user) => user.uid !== userId));
  }

  /** Creates the channel with the chosen members and closes both dialogs. */
  async createChannel(): Promise<void> {
    this.membersError = '';

    const currentUserId = this.authService.currentUserId();
    const memberIds =
      this.memberOption() === 'all'
        ? this.contactUsers().map((user) => user.uid)
        : this.selectedMembers().map((user) => user.uid);

    const channelId = await this.channelService.addChannel(
      this.name.trim(),
      this.description.trim(),
      memberIds,
    );

    if (!channelId) {
      this.membersError = 'A channel with this name already exists.';
      return;
    }

    this.channelService.selectChannel(channelId);
    this.closeMembersDialog();
  }

  /** Closes the member-selection dialog without creating the channel. */
  closeMembersDialog(): void {
    this.membersDialogRef.nativeElement.close();
    this.resetForm();
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

  /** Closes the members dialog only when the backdrop itself (not the card) was clicked. */
  onMembersBackdropClick(event: MouseEvent): void {
    if (event.target === this.membersDialogRef.nativeElement) {
      this.closeMembersDialog();
    }
  }

  /** Clears all form fields and the error message. */
  private resetForm(): void {
    this.name = '';
    this.description = '';
    this.errorMessage = '';
    this.memberOption.set('all');
    this.memberQuery = '';
    this.selectedMembers.set([]);
    this.membersError = '';
  }
}

