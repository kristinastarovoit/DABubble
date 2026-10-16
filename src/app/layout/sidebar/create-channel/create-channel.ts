import { Component, ElementRef, EventEmitter, Output, ViewChild, computed, inject, signal} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChannelService } from '../../../shared/services/channel-service';
import { AuthService } from '../../../shared/services/auth';
import { UserModel } from '../../../shared/model/user.model';
import { UserService } from '../../../shared/services/users';

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
  errorMessage = signal('');

  /** Provides the available channels and channel selection state. */
  channelService = inject(ChannelService);

  /** Provides reactive authentication state. */
  private authService = inject(AuthService);

  private userService = inject(UserService);

  /** Which member option is currently selected in the second step. */
  memberOption = signal<'all' | 'specific'>('all');

  /** Text entered in the "Enter name" search field. */
  memberQuery = '';

  /** Members chosen via the search field. */
  selectedMembers = signal<UserModel[]>([]);

  /** Validation or persistence error shown in the second step. */
  membersError = signal('');

  /** Whether enough information has been provided to create the channel. */
  canCreateChannel = computed(
    () => this.memberOption() === 'all' || this.selectedMembers().length > 0,
  );

  /** The channel that was active when channel creation started — the source for "all
   * contacts". Falls back to "Allgemeines" if no channel was active. */
  private sourceChannel = computed(() => {
    const channels = this.channelService.channels();
    const activeId = this.channelService.activeChannelId();
    return (
      channels.find((channel) => channel.id === activeId) ??
      channels.find((channel) => channel.name === 'Allgemeines')
    );
  });

  /** Display name of the source channel, shown in the "Add all contacts from #..." label. */
  sourceChannelName = computed(() => this.sourceChannel()?.name ?? '');

  /** The source channel's members (excluding the signed-in user), used by "Add all contacts". */
  private contactUsers = computed(() => {
    const channel = this.sourceChannel();
    if (!channel) return [];

    const currentUserId = this.authService.currentUserId();
    return this.userService
      .users()
      .filter((user) => channel.memberIds.includes(user.uid) && user.uid !== currentUserId);
  });

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

  /** Clears the channel-name validation message as soon as the user edits the field. */
  onNameInput(): void {
    if (this.errorMessage()) {
      this.errorMessage.set('');
    }
  }

  /** Validates the channel name and advances to the member-selection step. */
  async submit(): Promise<void> {
    this.errorMessage.set('');
    const trimmedName = this.name.trim();
    if (!trimmedName) {
      this.errorMessage.set('Please enter a channel name.');
      return;
    }

    if (await this.channelService.channelNameExists(trimmedName)) {
      this.errorMessage.set('A channel with this name already exists.');
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
    this.membersError.set('');
    const memberIds =
      this.memberOption() === 'all'
        ? this.contactUsers().map((user) => user.uid)
        : this.selectedMembers().map((user) => user.uid);
    const channelId = await this.channelService.addChannel(this.name.trim(), this.description.trim(), memberIds);
    if (!channelId) {
      this.membersError.set('A channel with this name already exists.');
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
    this.errorMessage.set('');
    this.memberOption.set('all');
    this.memberQuery = '';
    this.selectedMembers.set([]);
    this.membersError.set('');
  }
}
