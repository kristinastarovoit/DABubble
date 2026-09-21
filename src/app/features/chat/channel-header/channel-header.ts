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

  /** Requests the channel details view. */
  openChannelDetails(): void {
    this.editChannel.open();
    this.channelDetailsRequested.emit();
  }

  /** Opens the dialog showing the current channel members. */
  openMembersList(): void {
    this.showAddMembersView.set(false);
    this.positionDialog();
    this.membersDialog.nativeElement.showModal();
  }

  /** Opens the dialog directly in "add members" mode. */
  openAddMembers(): void {
    this.showAddMembersView.set(true);
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
  }

  /** Closes the dialog when the backdrop itself is clicked. */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeDialog();
    }
  }

  /** Adds the entered user to the active channel.
   * TODO: an ChannelService anbinden, sobald eine entsprechende Methode existiert
   * (z.B. channelService.addMemberToChannel(channelId, uid)).
   */
  addMember(): void {
    const query = this.addMemberQuery.trim();
    if (!query) return;

    const matchedUser = this.userService.users().find(
      user => user.name.toLowerCase() === query.toLowerCase()
    );

    if (!matchedUser) {
      // TODO: Fehlermeldung anzeigen, falls kein Nutzer mit dem Namen gefunden wurde
      return;
    }

    // TODO: matchedUser.uid zur memberIds-Liste des aktiven Channels hinzufügen

    this.addMemberQuery = '';
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
