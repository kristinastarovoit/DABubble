import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../shared/services/auth';
import { UserService } from '../../shared/services/users';
import { Router } from '@angular/router';
import { Presence } from '../../shared/services/presence';
import { MessageSearchResult, SearchService } from '../../shared/services/search-service';
import { MessageNavigationService } from '../../shared/services/message-navigation-service';
import { Channel } from '../../shared/interfaces/channel';
import { ChannelService } from '../../shared/services/channel-service';
import { DmService } from '../../shared/services/dm-service';
import { UserModel } from '../../shared/model/user.model';
import { ThreadService } from '../../shared/services/thread-service';
import { Message } from '../../shared/interfaces/message';

/** Displays the app header, global search, and user profile controls. */
@Component({
  imports: [FormsModule],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {
  /** Provides authentication state and logout operations. */
  private authService = inject(AuthService);

  /** Provides workspace user profiles. */
  private userService = inject(UserService);

  /** Navigates between application routes. */
  private router = inject(Router);

  /** Provides global message and user search. */
  private searchService = inject(SearchService);

  /** Navigates to a message selected from search results. */
  private navigationService = inject(MessageNavigationService);

  /** Provides channel selection and message operations. */
  private channelService = inject(ChannelService);

  /** Provides direct-message conversations and message operations. */
  private dmService = inject(DmService);

  /** Opens threads selected from search results. */
  private threadService = inject(ThreadService);

  /** Provides live presence state and updates. */
  presenceService = inject(Presence);

  /** Search results currently returned by the search service. */
  searchResults = this.searchService.results;

  /** Whether valid search results should be shown while search is open. */
  showSearchResults = computed(() => this.searchService.isQueryValid() && this.isSearchOpen());

  /** Whether the global search results panel is open. */
  isSearchOpen = signal(false);

  /** Validation error displayed for the profile name field. */
  nameError = signal('');

  /** The profile of the currently signed-in user, or `undefined` while loading or logged out. */
  currentUser = computed(() =>
    this.userService.users().find((user) => user.uid === this.authService.currentUserId()),
  );

  /** Mobile only: whether a chat/thread is open, replacing the logo with a back navigation. */
  chatMode = input(false);

  /** Emitted when the mobile back navigation is clicked. */
  back = output<void>();

  /** Current value of the global search field. */
  searchQuery = '';

  /** Whether the user menu is visible. */
  isUserMenuOpen = signal(false);

  /** Whether the user-profile-menu is visible. */
  isUserProfileOpen = signal(false);

  /** Whether the profile card is in edit mode. */
  isEditingUser = signal(false);

  /** Path of the avatar selected while editing the profile. */
  selectedAvatar = signal('');

  /** Channel message results from the global search. */
  channelMessageResult = computed(() =>
    this.searchResults().messages.filter((r) => r.source === 'channel'),
  );

  /** Direct-message results from the global search. */
  dmMessageResult = computed(() => this.searchResults().messages.filter((r) => r.source === 'dm'));

  /** Thread reply results from the global search. */
  threadMessageResult = computed(() =>
    this.searchResults().messages.filter(
      (r) => r.source === 'channel-thread' || r.source === 'dm-thread',
    ),
  );

  /** Current value of the profile name input. */
  nameInput = signal('');

  /** Avatar image paths available for profile selection. */
  protected readonly avatar = [
    'app-icons/avatar_1.svg',
    'app-icons/avatar_2.svg',
    'app-icons/avatar_3.svg',
    'app-icons/avatar_4.svg',
    'app-icons/avatar_5.svg',
    'app-icons/avatar_6.svg',
  ];

  /** Toggles the user menu. */
  toggleUserMenu(): void {
    this.isUserMenuOpen.update((isOpen) => !isOpen);
  }

  /** Closes the user menu. */
  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  /** Opens the user-profile menu. */
  openUserProfile() {
    this.isUserProfileOpen.set(true);
  }

  /** Closes the user-profile menu. */
  closeUserProfile() {
    this.isUserProfileOpen.set(false);
  }

  /** Initializes the profile-editing fields with the current user's values. */
  editUserProfile() {
    this.selectedAvatar.set(this.currentUser()?.avatar ?? '');
    this.nameInput.set(this.currentUser()?.name ?? '');
    this.nameError.set('');
    this.isEditingUser.set(true);
  }

  /** Discards profile edits and exits edit mode. */
  cancelUserProfileEdit() {
    this.selectedAvatar.set('');
    this.nameError.set('');
    this.isEditingUser.set(false);
  }

  /**
   * Selects an avatar for the current profile edit.
   *
   * @param avatar The path of the selected avatar image.
   */
  selectAvatar(avatar: string) {
    this.selectedAvatar.set(avatar);
  }

  /**
   * Saves changes to the signed-in user's display name and/or avatar, then leaves edit mode.
   * Does nothing if nobody is signed in or the trimmed name is empty.
   *
   * @param newName The raw value from the name input; it is trimmed before use.
   */
  async saveProfileChanges(newName: string): Promise<void> {
    const currentUser = this.currentUser();
    if (!currentUser) return;
    const trimmedName = newName.trim();
    if (!this.validateName(trimmedName)) return;

    if (trimmedName !== currentUser.name) {
      await this.userService.editUserName(currentUser.uid, trimmedName);
    }
    const avatar = this.selectedAvatar();
    if (avatar && avatar !== currentUser.avatar) {
      await this.userService.editUserAvatar(currentUser.uid, avatar);
    }
    this.isEditingUser.set(false);
  }

  /** Handles changes to the global search field. */
  onSearchInput(): void {
    this.searchService.setQuery(this.searchQuery);
    this.isSearchOpen.set(true);
  }

  /** Closes the global search results panel. */
  closeSearchResult() {
    this.isSearchOpen.set(false);
  }

  /** Sets the user offline, performs the appropriate logout cleanup, and navigates to login. */
  async logout(): Promise<void> {
    void this.presenceService.goOffline().catch((error) => {
      console.error('Failed to set presence offline during logout.', error);
    });
    const currentUser = this.currentUser();
    if (this.authService.isCurrentUserAnonymous && currentUser) {
      await this.deleteGuestAccount(currentUser.uid);
    } else {
      await this.authService.logout();
    }
    await this.router.navigateByUrl('/login');
  }

  /**
   * Removes a guest's content and channel memberships, then deletes their account.
   *
   * @param uid The guest user's ID.
   */
  private async deleteGuestAccount(uid: string): Promise<void> {
    try {
      await Promise.all([this.channelService.deleteGuestMessages(uid), this.dmService.deleteGuestMessages(uid)]);
    } catch (error) {
      console.error('Failed to delete guest messages during logout.', error);
    }
    try {
      await this.channelService.removeGuestFromChannels(uid);
    } catch (error) {
      console.error('Failed to remove guest from channels during logout.', error);
    }
    await this.userService.deleteUserProfile(uid);
    await this.authService.deleteCurrentUser();
  }

  /**
   * Opens the channel selected from search results and clears the search.
   *
   * @param channel The channel selected by the user.
   */
  openChannelResult(channel: Channel): void {
    this.channelService.selectChannel(channel.id);
    this.resetSearch();
  }

  /**
   * Opens the selected message or thread result and clears the search.
   *
   * @param result The message search result selected by the user.
   */
  openMessageResult(result: MessageSearchResult): void {
    if (!result.message.id) return;

    if (result.source === 'channel-thread' || result.source === 'dm-thread') {
      void this.openThreadResult(result);
    } else if (result.source === 'channel') {
      this.navigationService.goToChannelMessage(result.conversationId, result.message.id);
    } else {
      this.navigationService.goToDmMessage(result.conversationId, result.message.id);
    }

    this.resetSearch();
  }

  /** Clears the search query, results, and open results panel. */
  private resetSearch(): void {
    this.searchService.clear();
    this.searchQuery = '';
    this.closeSearchResult();
  }

  /**
   * Opens the thread containing the selected thread-reply search result.
   *
   * @param result The thread-reply search result to open.
   */
  private async openThreadResult(result: MessageSearchResult): Promise<void> {
    if (!result.parentMessageId) return;
    const isChannel = result.source === 'channel-thread';
    const service = isChannel ? this.channelService : this.dmService;
    const parentMessage = await this.fetchMessageOnce(service, result.conversationId, result.parentMessageId);
    if (!parentMessage) return;

    if (isChannel) this.channelService.selectChannel(result.conversationId);
    else this.dmService.selectDm(result.conversationId);
    this.threadService.open(parentMessage, {
      channelId: isChannel ? result.conversationId : undefined,
      dmId: isChannel ? undefined : result.conversationId,
    });
  }

  /**
   * Resolves once with the current value of a channel or DM message, then unsubscribes.
   *
   * @param service Channel or DM service used to subscribe to the message.
   * @param conversationId The channel or direct-message conversation ID.
   * @param messageId The ID of the message to fetch.
   * @returns The message when received, or `null` if the listener provides no message.
   */
  private fetchMessageOnce(
    service: { getMessage: ChannelService['getMessage'] },
    conversationId: string,
    messageId: string,
  ): Promise<Message | null> {
    return new Promise((resolve) => {
      const { unsubscribe } = service.getMessage(conversationId, messageId, (message) => {
        unsubscribe();
        resolve(message);
      });
    });
  }

  /** Reopens search results on focus when the current query is valid. */
  onSearchFocus(): void {
    if (this.searchService.isQueryValid()) {
      this.isSearchOpen.set(true);
    }
  }

  /**
   * Opens a direct message with the user selected from search results.
   *
   * @param user The user selected by the search.
   */
  async openUserResult(user: UserModel): Promise<void> {
    await this.dmService.openDmWith(user.uid);
    this.resetSearch();
  }

  /** Updates the profile name field and validates its current value. */
  onNameInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.nameInput.set(value);
    this.validateName(value);
  }

  /**
   * Validates that a profile name contains at least two parts made of letters, apostrophes, or hyphens.
   *
   * @param value The name value to validate.
   * @returns Whether the trimmed name is valid.
   */
  private validateName(value: string): boolean {
    const trimmed = value.trim();
    const parts = trimmed.split(/\s+/).filter(Boolean);
    const onlyLetters = /^[\p{L}'-]+$/u;
    const isValid = parts.length >= 2 && parts.every((p) => onlyLetters.test(p));

    this.nameError.set(isValid ? '' : 'Please enter your first and last name.');
    return isValid;
  }
}
