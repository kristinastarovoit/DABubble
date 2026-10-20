import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject, computed, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChannelService } from '../../../shared/services/channel-service';
import { UserService } from '../../../shared/services/users';
import { UserModel } from '../../../shared/model/user.model';
import { DmService } from '../../../shared/services/dm-service';
import { UsercardDialog } from '../../../shared/components/usercard-dialog/usercard-dialog';
import { Presence } from '../../../shared/services/presence';
import { resolveMemberToAdd } from '../../../shared/utilities/member-lookup.utils';

@Component({
  imports: [FormsModule, UsercardDialog],
  selector: 'app-edit-channel',
  styleUrl: './edit-channel.scss',
  templateUrl: './edit-channel.html',
})
export class EditChannel {
  /** Provides access to workspace users. */
  private userService = inject(UserService);

  /** Provides direct-message lookup and creation. */
  private dmService = inject(DmService);

  /** Provides the live presence state for channel members. */
  presenceService = inject(Presence);

  /** Names of channels already in use, used for duplicate validation. */
  @Input() existingChannelNames: string[] = [];

  /** Members of the currently active channel. */
  channelMembers = input<UserModel[]>([]);

  /** UID of the currently signed-in user. */
  currentUserId = input('');

  /** Whether the signed-in user is included in the active channel's member list. */
  isCurrentUserMember = computed(() =>
    this.channelMembers().some((member) => member.uid === this.currentUserId()),
  );

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

  /** Reference to the native channel-settings dialog. */
  @ViewChild('dialogRef') private dialogRef!: ElementRef<HTMLDialogElement>;

  /** Resizes the description field after it is rendered. */
  @ViewChild('descriptionInput')
  set descriptionInput(element: ElementRef<HTMLTextAreaElement> | undefined) {
    if (!element) return;

    requestAnimationFrame(() => {
      if (element.nativeElement.isConnected) {
        this.resizeDescriptionElement(element.nativeElement);
      }
    });
  }

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

  /** User currently selected for display in the profile dialog. */
  selectedUser = signal<UserModel | undefined>(undefined);

  /**
   * Opens an existing direct message with the selected user or creates one if needed.
   * Clears the active channel after selecting the direct message.
   * @param user The user to message.
   */
  async openDmWithUser(user: UserModel): Promise<void> {
    await this.dmService.openDmWith(user.uid);
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
    if (!channelId || !channel) return this.failAddMember('No active channel selected.');

    const result = resolveMemberToAdd(query, this.userService.users(), channel.memberIds);
    if ('errorMessage' in result) return this.failAddMember(result.errorMessage);

    if (!(await this.tryAddMember(result.user.uid, channelId))) return;
    this.addMemberQuery.set('');
    this.addMemberError.set('');
    this.showAddMembers.set(false);
  }

  private failAddMember(message: string): void {
    this.addMemberError.set(message);
  }

  /** Adds the given user to the channel, reporting failure via `addMemberError`. */
  private async tryAddMember(uid: string, channelId: string): Promise<boolean> {
    try {
      await this.channelService.addMembersToChannel([uid], channelId);
      return true;
    } catch (error) {
      console.error('Failed to add member to channel.', error);
      this.addMemberError.set('Member could not be added. Please try again.');
      return false;
    }
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

  /** Resizes the description textarea to fit its current content. */
  resizeDescription(event: Event): void {
    this.resizeDescriptionElement(event.currentTarget as HTMLTextAreaElement);
  }

  /** Saves the description when Enter is pressed instead of inserting a line break. */
  saveDescriptionOnEnter(event: Event): void {
    event.preventDefault();
    void this.saveDescription();
  }

  /** Sets the textarea height to match its content. */
  private resizeDescriptionElement(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
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
