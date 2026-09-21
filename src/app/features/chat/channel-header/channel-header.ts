import { Component, EventEmitter, Output, inject, computed, signal, effect, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Message } from '../../../shared/interfaces/message';
import { ChannelService } from '../../../shared/services/channel-service';
import { UserService } from '../../../shared/services/users';
import { FIREBASE_AUTH } from '../../../app.config';
import { EditChannel } from '../edit-channel/edit-channel';

@Component({
  imports: [CommonModule, FormsModule, EditChannel],
  selector: 'app-channel-header',
  styleUrl: './channel-header.scss',
  templateUrl: './channel-header.html',
})
export class ChannelHeader {


  /** Emitted when channel details are requested. */
  @Output() channelDetailsRequested = new EventEmitter<void>();

  /** Reference to the channel-settings dialog. */
  @ViewChild('editChannel') private editChannel!: EditChannel;

  /** Reference to the container holding avatars + add-button, used to position the dialog. */
  @ViewChild('metaRef') private metaRef!: ElementRef<HTMLDivElement>;

  /** Reference to the members / add-members dialog. */
  @ViewChild('membersDialog') private membersDialog!: ElementRef<HTMLDialogElement>;

  /** Controls which view is shown inside the members dialog. */
  showAddMembersView = signal(false);

  /** Text entered in the "Name eingeben" field. */
  addMemberQuery = '';

  /** Validation or persistence error shown in the add-members view. */
  addMemberError = '';

  /** Users matching the current query that are not channel members yet. */
  get memberSuggestions() {
    const query = this.addMemberQuery.trim().toLowerCase();
    if (!query) return [];

    const memberIds = this.activeChannel()?.memberIds ?? [];
    return this.userService.users().filter(
      user => !memberIds.includes(user.uid) && user.name.toLowerCase().includes(query)
    );
  }

  /** Requests the channel details view. */
  openChannelDetails(): void {
    this.editChannel.open();
    this.channelDetailsRequested.emit();
  }

  /** Opens the dialog showing the current channel members. */
  openMembersList(): void {
    this.showAddMembersView.set(false);
    this.addMemberError = '';
    this.positionDialog();
    this.membersDialog.nativeElement.showModal();
  }

  /** Opens the dialog directly in "add members" mode. */
  openAddMembers(): void {
    this.showAddMembersView.set(true);
    this.addMemberError = '';
    this.positionDialog();
    this.membersDialog.nativeElement.showModal();
  }

  /** Positions the dialog directly below the meta container (avatars + add-button row). */
  private positionDialog(): void {
    const rect = this.metaRef.nativeElement.getBoundingClientRect();
    const dialog = this.membersDialog.nativeElement;

    dialog.style.top = `${rect.bottom + 8}px`;
    dialog.style.right = `${window.innerWidth - rect.right}px`;
    dialog.style.left = 'auto';
  }

  /** Closes the members dialog. */
  closeDialog(): void {
    this.membersDialog.nativeElement.close();
    this.addMemberQuery = '';
    this.addMemberError = '';
  }

  /** Closes the dialog when the backdrop itself is clicked. */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeDialog();
    }
  }

  /** Selects a user from the live search results. */
  selectMember(userName: string): void {
    this.addMemberQuery = userName;
    this.addMemberError = '';
  }

  /** Adds the entered user to the active channel. */
  async addMember(): Promise<void> {
    const query = this.addMemberQuery.trim();
    if (!query) return;

    this.addMemberError = '';

    const channelId = this.channelId();
    const activeChannel = this.activeChannel();
    if (!channelId || !activeChannel) {
      this.addMemberError = 'No active channel selected.';
      return;
    }

    const matchedUser = this.userService.users().find(
      user => user.name.toLowerCase() === query.toLowerCase()
    );

    if (!matchedUser) {
      this.addMemberError = 'No member with this name was found.';
      return;
    }

    if (activeChannel.memberIds.includes(matchedUser.uid)) {
      this.addMemberError = 'This user is already a member of this channel.';
      return;
    }

    try {
      await this.channelService.addMembersToChannel([matchedUser.uid], channelId);
    } catch {
      this.addMemberError = 'Member could not be added. Please try again.';
      return;
    }

    this.addMemberQuery = '';
    this.addMemberError = '';
    this.showAddMembersView.set(false);
  }

  /** Provides the available channels and their messages. */
  channelService = inject(ChannelService);

  /** Provides all workspace users. */
  userService = inject(UserService);

  /** Identifier of the currently selected channel. */
  channelId = computed(() => this.channelService.activeChannelId());

  /** The channel matching the currently selected channel ID. */
  activeChannel = computed(() =>
    this.channelService.channels().find(channel => channel.id === this.channelId())
  );

  /** Full user objects of the current channel's members. */
  channelMembers = computed(() => {
    const memberIds = this.activeChannel()?.memberIds ?? [];
    return this.userService.users().filter(user => memberIds.includes(user.uid));
  });

  /** UID of the currently logged-in user. */
  currentUserId = computed(() => inject(FIREBASE_AUTH).currentUser?.uid ?? '');

  /** Messages belonging to the currently selected channel. */
  messages = signal<Message[]>([]);

  /** Unsubscribes from the current message listener when the channel changes. */
  private currentUnsubscribe: (() => void) | undefined;

  /** Creates the message listener for the active channel. */
  constructor() {
    effect(() => {
      this.currentUnsubscribe?.();

      const channelId = this.channelId();

      if (channelId) {
        const { unsubscribe } = this.channelService.getMessages(
          channelId,
          messages => this.messages.set(messages)
        );
        this.currentUnsubscribe = unsubscribe;
      }
    });
  }
}
