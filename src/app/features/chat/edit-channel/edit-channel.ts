import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChannelService } from '../../../shared/services/channel-service';
import { UserService } from '../../../shared/services/users';
import { UserModel } from '../../../shared/model/user.model';
import { DmService } from '../../../shared/services/dm-service';
import { AuthService } from '../../../shared/services/auth';
import { UsercardDialog } from '../../../shared/components/usercard-dialog/usercard-dialog';

@Component({
  imports: [FormsModule, UsercardDialog],
  selector: 'app-edit-channel',
  styleUrl: './edit-channel.scss',
  templateUrl: './edit-channel.html',
})
export class EditChannel {
  private userService = inject(UserService);
  private dmService = inject(DmService);
  private authService = inject(AuthService);

  /** Names of channels already in use, used for duplicate validation. */
  @Input() existingChannelNames: string[] = [];

  /** Members of the currently active channel. */
  channelMembers = input<UserModel[]>([]);

  /** UID of the currently signed-in user. */
  currentUserId = input('');

  /** Whether the inline add-member form is visible. */
  showAddMembers = signal(false);

  /** Search query used to find users to add to the channel. */
  addMemberQuery = signal('');

  /** Error shown when adding a member fails. */
  addMemberError = signal('');

  /** Users who are not yet members and match the current search query. */
  memberSuggestions = computed(() => {
    const query = this.addMemberQuery().trim().toLowerCase();
    if (!query) return [];

    const memberIds = new Set(this.channelMembers().map((member) => member.uid));
    return this.userService
      .users()
      .filter((user) => !memberIds.has(user.uid) && user.name.toLowerCase().includes(query));
  });

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
  isEditingName = signal(false);

  /** Whether the description field is in edit mode. */
  isEditingDescription = signal(false);

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

  selectedUser = signal<UserModel | undefined>(undefined);

  async openDmWithUser(user: UserModel) {
    const userId = this.authService.currentUserId();
    if (!userId) return;
    const partner = this.dmService.dmPartners().find((p) => p.user.uid === user.uid);
    if (partner?.dm) {
      this.dmService.selectDm(partner.dm.id);
    } else {
      const dmId = await this.dmService.addDm([userId, user.uid]);
      this.dmService.selectDm(dmId);
    }
    this.channelService.activeChannelId.set(undefined);
  }

  /** Opens the dialog as a modal. */
  open(): void {
    this.dialogRef.nativeElement.showModal();
  }

  /** Closes the dialog and discards unsaved edits. */
  close(): void {
    this.dialogRef.nativeElement.close();
    this.isEditingName.set(false);
    this.isEditingDescription.set(false);
    this.showAddMembers.set(false);
    this.addMemberQuery.set('');
    this.addMemberError.set('');
    this.closed.emit();
  }

  /** Opens the inline form for adding channel members. */
  openAddMembers(): void {
    this.showAddMembers.set(true);
    this.addMemberQuery.set('');
    this.addMemberError.set('');
  }

  /** Adds the user whose name was entered to the active channel. */
  async addMember(): Promise<void> {
    const query = this.addMemberQuery().trim();
    if (!query) return;

    const channelId = this.channelId();
    const channel = this.activeChannel();
    if (!channelId || !channel) {
      this.addMemberError.set('No active channel selected.');
      return;
    }

    const member = this.userService
      .users()
      .find((user) => user.name.toLowerCase() === query.toLowerCase());
    if (!member) {
      this.addMemberError.set('No member with this name was found.');
      return;
    }

    if (channel.memberIds.includes(member.uid)) {
      this.addMemberError.set('This user is already a member of this channel.');
      return;
    }

    try {
      await this.channelService.addMembersToChannel([member.uid], channelId);
    } catch (error) {
      console.error('Failed to add member to channel.', error);
      this.addMemberError.set('Member could not be added. Please try again.');
      return;
    }

    this.addMemberQuery.set('');
    this.addMemberError.set('');
    this.showAddMembers.set(false);
  }

  /** Enters edit mode for the channel name. */
  startEditingName(): void {
    this.editedName = this.activeChannel()?.name ?? '';
    this.nameErrorMessage = '';
    this.isEditingName.set(true);
  }

  /** Validates and saves the edited channel name. */
  async saveName(): Promise<void> {
    const channel = this.activeChannel();
    if (!channel) return;

    const trimmed = this.editedName.trim();
    if (!this.isValidName(trimmed, channel.name)) return;

    await this.channelService.editChannelName(trimmed, channel.id);
    this.isEditingName.set(false);
    this.nameUpdated.emit(trimmed);
  }

  /** Validates the edited channel name. */
  private isValidName(name: string, currentName: string): boolean {
    this.nameErrorMessage = '';
    if (!name) {
      this.nameErrorMessage = 'The Channel name must not be empty';
      return false;
    }
    const nameAlreadyExists = this.existingChannelNames
      .filter(existingName => existingName !== currentName)
      .includes(name);
    if (nameAlreadyExists) {
      this.nameErrorMessage = 'A Channel with this name already exists.';
      return false;
    }
    return true;
  }

  /** Enters edit mode for the channel description. */
  startEditingDescription(): void {
    this.editedDescription = this.activeChannel()?.description ?? '';
    this.isEditingDescription.set(true);
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
    this.isEditingDescription.set(false);
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

  /** Returns the display name for the given creator ID. */
  getCreatorName(creatorId: string): string {
    return this.userService.users().find(user => user.uid === creatorId)?.name ?? creatorId;
  }
}
