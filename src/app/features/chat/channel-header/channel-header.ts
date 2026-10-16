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
import { UsercardDialog } from "../../../shared/components/usercard-dialog/usercard-dialog";
import { UserModel } from '../../../shared/model/user.model';
import { Presence } from '../../../shared/services/presence';
import { resolveMemberToAdd } from '../../../shared/utilities/member-lookup.utils';

/** A selectable channel, contact, or email match shown in the recipient search. */
type RecipientSuggestion =
  | { type: 'channel'; id: string; name: string }
  | { type: 'user'; id: string; name: string; avatar: string }
  | { type: 'email'; id: string; email: string };

/** Displays the active channel header and its member and recipient dialogs. */
@Component({
  imports: [CommonModule, FormsModule, EditChannel, UsercardDialog],
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

  /** Reference to the "New Message" recipient search input, used to position the suggestions dropdown. */
  @ViewChild('recipientSearchInput') private recipientSearchInput?: ElementRef<HTMLInputElement>;

  /** Text entered in the "New Message" recipient search field. */
  recipientQuery = '';

  /** Controls visibility of the recipient suggestions dropdown. */
  showRecipientSuggestions = signal(false);

  /** Fixed position and size of the recipient suggestions dropdown, kept within the viewport. */
  recipientSuggestionsPosition = { top: 0, left: 0, width: 0, maxHeight: 240 };

  /** User currently selected for a member-related action, if any. */
  selectedUser = signal<UserModel | undefined>(undefined);

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

  /** Text entered in the "Enter name" field. */
  addMemberQuery = '';

  /** Validation or persistence error shown in the add-members view. */
  addMemberError = '';

  /** Controls visibility of the separate member suggestions dropdown. */
  showMemberSuggestions = signal(false);

  /** Fixed position and width of the suggestions dropdown. */
  suggestionsPosition = { top: 0, left: 0, width: 0 };

  /** Provides the available channels and their messages. */
  channelService = inject(ChannelService);

  /** Provides all workspace users. */
  userService = inject(UserService);

  /** Provides the live presence state for workspace members. */
  presenceService = inject(Presence);

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

  /**
   * Channels, contacts, and matching contact email addresses for the current recipient query.
   *
   * A leading `#` restricts the search to channels. Contact names and email addresses are
   * matched independently, so both suggestions appear when the query matches both fields.
   *
   * @returns The matching channels, contacts, and email addresses, with channels first.
   */
  get recipientSuggestions(): RecipientSuggestion[] {
    const raw = this.recipientQuery.trim();
    const mode = this.recipientSearchMode;
    const query = (raw.startsWith('#') || raw.startsWith('@') ? raw.slice(1) : raw).toLowerCase();

    // Without a prefix, an empty query yields no suggestions; with a prefix, it lists everything.
    if (mode === 'mixed' && !query) return [];

    const channelMatches = mode === 'user' ? [] : this.matchingChannelSuggestions(query);
    const userMatches = mode === 'channel' ? [] : this.matchingContactSuggestions(query);
    return [...channelMatches, ...userMatches];
  }

  /**
   * Finds channels whose names contain the current recipient query.
   *
   * @param query The normalized query to match against channel names.
   * @returns Matching channels as recipient suggestions.
   */
  private matchingChannelSuggestions(query: string): RecipientSuggestion[] {
    return this.channelService
      .channels()
      .filter((channel) => channel.name.toLowerCase().includes(query))
      .map((channel) => ({ type: 'channel' as const, id: channel.id, name: channel.name }));
  }

  /**
   * Finds contacts other than the current user that match the recipient query.
   *
   * @param query The normalized query to match against contact names and email addresses.
   * @returns Matching contacts as user or email suggestions.
   */
  private matchingContactSuggestions(query: string): RecipientSuggestion[] {
    const currentUserId = this.authService.currentUserId();
    return this.dmService
      .dmPartners()
      .filter((partner) => partner.user.uid !== currentUserId)
      .flatMap((partner) => this.contactSuggestionsFor(partner.user, query));
  }

  /** Builds the name- and/or email-matched suggestions for a single contact. */
  private contactSuggestionsFor(user: UserModel, query: string): RecipientSuggestion[] {
    const matches: RecipientSuggestion[] = [];
    if (user.name.toLowerCase().includes(query)) {
      matches.push({ type: 'user', id: user.uid, name: user.name, avatar: user.avatar });
    }
    if (user.email.toLowerCase().includes(query)) {
      matches.push({ type: 'email', id: user.uid, email: user.email });
    }
    return matches;
  }

  /** Determines whether the recipient query targets channels, users, or both. */
  private get recipientSearchMode(): 'channel' | 'user' | 'mixed' {
    const raw = this.recipientQuery.trim();
    if (raw.startsWith('#')) return 'channel';
    if (raw.startsWith('@') || raw.includes('@')) return 'user';
    return 'mixed';
  }

  /** Updates the recipient suggestions dropdown and its viewport-relative position while the user types. */
  onRecipientQueryChange(): void {
    const hasQuery = Boolean(this.recipientQuery.trim());
    this.showRecipientSuggestions.set(hasQuery);
    if (!hasQuery || !this.recipientSearchInput) return;

    const rect = this.recipientSearchInput.nativeElement.getBoundingClientRect();
    const availableHeight = window.innerHeight - rect.bottom - 12;
    this.recipientSuggestionsPosition = {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(availableHeight, 100),
    };
  }

  /**
   * Selects a channel or contact as the recipient and leaves "New Message" mode.
   *
   * @param suggestion The chosen channel or user suggestion.
   */
  async selectRecipient(suggestion: RecipientSuggestion): Promise<void> {
    this.recipientQuery = '';
    this.showRecipientSuggestions.set(false);

    if (suggestion.type === 'channel') {
      this.channelService.selectChannel(suggestion.id);
    } else {
      await this.dmService.openDmWith(suggestion.id);
    }
  }

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
    const dialog = this.membersDialog.nativeElement;

    if (window.matchMedia('(max-width: 800px)').matches) {
      dialog.style.removeProperty('top');
      dialog.style.removeProperty('right');
      dialog.style.removeProperty('left');
      return;
    }

    const rect = this.metaRef.nativeElement.getBoundingClientRect();
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
    this.positionMemberSuggestions();
  }

  /** Positions the member-suggestions dropdown directly below the search input. */
  private positionMemberSuggestions(): void {
    const rect = this.memberSearchInput.nativeElement.getBoundingClientRect();
    this.suggestionsPosition = { top: rect.bottom + 4, left: rect.left, width: rect.width };
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
    this.addMemberError = '';
    if (!query) return;
    const channelId = this.channelId();
    const activeChannel = this.activeChannel();
    if (!channelId || !activeChannel) return this.failAddMember('No active channel selected.');

    const result = resolveMemberToAdd(query, this.userService.users(), activeChannel.memberIds);
    if ('errorMessage' in result) return this.failAddMember(result.errorMessage);

    if (!(await this.tryAddMember(result.user.uid, channelId))) return;
    this.resetAddMemberState();
  }

  /** Stores an error message for display in the add-member view. */
  private failAddMember(message: string): void {
    this.addMemberError = message;
  }

  /** Clears the add-member form and returns the dialog to its member-list view. */
  private resetAddMemberState(): void {
    this.addMemberQuery = '';
    this.addMemberError = '';
    this.showMemberSuggestions.set(false);
    this.showAddMembersView.set(false);
  }

  /** Adds the given user to the channel, reporting failure via `addMemberError`. */
  private async tryAddMember(uid: string, channelId: string): Promise<boolean> {
    try {
      await this.channelService.addMembersToChannel([uid], channelId);
      return true;
    } catch {
      this.addMemberError = 'Member could not be added. Please try again.';
      return false;
    }
  }

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

  /**
   * Opens the direct-message conversation with the given user and closes the members dialog.
   * Creates the conversation first if none exists yet.
   *
   * @param user The user selected in the member list to start or continue a DM with.
   */
  async openDmWithUser(user: UserModel): Promise<void> {
    await this.dmService.openDmWith(user.uid);
    this.channelService.activeChannelId.set(undefined);
    this.closeDialog();
  }
}
