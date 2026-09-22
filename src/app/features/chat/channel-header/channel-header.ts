import {
  Component,
  EventEmitter,
  Output,
  inject,
  computed,
  signal,
  effect,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Message } from '../../../shared/interfaces/message';
import { ChannelService } from '../../../shared/services/channel-service';
import { UserService } from '../../../shared/services/users';
import { DmService } from '../../../shared/services/dm-service';
import { AuthService } from '../../../shared/services/auth';
import { NewMessageService } from '../../../shared/services/new-message-service';
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

  /** Provides direct-message data, used for the "New Message" recipient search. */
  private dmService = inject(DmService);

  /** Provides reactive authentication state. */
  private authService = inject(AuthService);

  /** Tracks whether the "New Message" recipient picker is currently active. */
  newMessageService = inject(NewMessageService);

  /** Text entered in the "New Message" recipient search field. */
  recipientQuery = '';

  /** Controls visibility of the recipient suggestions dropdown. */
  showRecipientSuggestions = signal(false);

  /** Channels and contacts matching the current recipient query. */
  get recipientSuggestions(): Array<
    | { type: 'channel'; id: string; name: string }
    | { type: 'user'; id: string; name: string; avatar: string }
  > {
    const query = this.recipientQuery.trim().toLowerCase();
    if (!query) return [];

    const currentUserId = this.authService.currentUserId();
    const channelMatches = this.channelService
      .channels()
      .filter((channel) => channel.name.toLowerCase().includes(query))
      .map((channel) => ({ type: 'channel' as const, id: channel.id, name: channel.name }));

    const userMatches = this.dmService
      .dmPartners()
      .filter((partner) => partner.user.uid !== currentUserId)
      .filter((partner) => partner.user.name.toLowerCase().includes(query))
      .map((partner) => ({
        type: 'user' as const,
        id: partner.user.uid,
        name: partner.user.name,
        avatar: partner.user.avatar,
      }));

    return [...channelMatches, ...userMatches];
  }

  /** Updates the recipient suggestions dropdown while the user types. */
  onRecipientQueryChange(): void {
    this.showRecipientSuggestions.set(Boolean(this.recipientQuery.trim()));
  }

  /** Selects a channel or contact as the recipient and leaves "New Message" mode. */
  async selectRecipient(
    suggestion:
      | { type: 'channel'; id: string; name: string }
      | { type: 'user'; id: string; name: string; avatar: string },
  ): Promise<void> {
    this.recipientQuery = '';
    this.showRecipientSuggestions.set(false);

    if (suggestion.type === 'channel') {
      this.channelService.selectChannel(suggestion.id);
      return;
    }

    const currentUserId = this.authService.currentUserId();
    if (!currentUserId) return;

    const partner = this.dmService.dmPartners().find((p) => p.user.uid === suggestion.id);
    if (partner?.dm) {
      this.dmService.selectDm(partner.dm.id);
    } else {
      const dmId = await this.dmService.addDm([currentUserId, suggestion.id]);
      this.dmService.selectDm(dmId);
    }
  }

  /** Reference to the channel-settings dialog. */
  @ViewChild('editChannel') private editChannel!: EditChannel;

  /** Reference to the container holding avatars + add-button, used to position the dialog. */
  @ViewChild('metaRef') private metaRef!: ElementRef<HTMLDivElement>;

  /** Reference to the members / add-members dialog. */
  @ViewChild('membersDialog') private membersDialog!: ElementRef<HTMLDialogElement>;

  /** Reference to the member search input used to anchor the suggestions. */
  @ViewChild('memberSearchInput') private memberSearchInput!: ElementRef<HTMLInputElement>;

  /** Controls which view is shown inside the members dialog. */
  showAddMembersView = signal(false);

  /** Text entered in the "Name eingeben" field. */
  addMemberQuery = '';

  /** Validation or persistence error shown in the add-members view. */
  addMemberError = '';

  /** Controls visibility of the separate member suggestions dropdown. */
  showMemberSuggestions = signal(false);

  /** Fixed position and width of the suggestions dropdown. */
  suggestionsPosition = { top: 0, left: 0, width: 0 };

  /** Users matching the current query that are not channel members yet. */
  get memberSuggestions() {
    const query = this.addMemberQuery.trim().toLowerCase();
    if (!query) return [];

    const memberIds = this.activeChannel()?.memberIds ?? [];
    return this.userService
      .users()
      .filter((user) => !memberIds.includes(user.uid) && user.name.toLowerCase().includes(query));
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
    this.showMemberSuggestions.set(false);
    this.positionDialog();
    this.membersDialog.nativeElement.showModal();
  }

  /** Opens the dialog directly in "add members" mode. */
  openAddMembers(): void {
    this.showAddMembersView.set(true);
    this.addMemberError = '';
    this.showMemberSuggestions.set(false);
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
    this.showMemberSuggestions.set(false);
  }

  /** Closes the dialog when the backdrop itself is clicked. */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeDialog();
    }
  }

  /** Updates the separate dropdown position while the user types. */
  onMemberQueryChange(): void {
    const query = this.addMemberQuery.trim();
    this.showMemberSuggestions.set(Boolean(query));

    if (!query) {
      this.addMemberError = '';
      return;
    }

    if (!this.memberSuggestions.length) {
      this.addMemberError = 'No matching members found.';
      return;
    }

    this.addMemberError = '';

    const rect = this.memberSearchInput.nativeElement.getBoundingClientRect();
    this.suggestionsPosition = {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    };
  }

  /** Selects a user from the live search results. */
  selectMember(userName: string): void {
    this.addMemberQuery = userName;
    this.addMemberError = '';
    this.showMemberSuggestions.set(false);
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

    const matchedUser = this.userService
      .users()
      .find((user) => user.name.toLowerCase() === query.toLowerCase());

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
    this.showMemberSuggestions.set(false);
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
    this.channelService.channels().find((channel) => channel.id === this.channelId()),
  );

  /** Full user objects of the current channel's members. */
  channelMembers = computed(() => {
    const memberIds = this.activeChannel()?.memberIds ?? [];
    return this.userService.users().filter((user) => memberIds.includes(user.uid));
  });

  /** Firebase Auth instance. */
  private auth = inject(FIREBASE_AUTH);

  /** UID of the currently logged-in user. */
  currentUserId = computed(() => this.auth.currentUser?.uid ?? '');

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
        const { unsubscribe } = this.channelService.getMessages(channelId, (messages) =>
          this.messages.set(messages),
        );
        this.currentUnsubscribe = unsubscribe;
      }
    });
  }
}
