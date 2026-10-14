import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
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

@Component({
  imports: [FormsModule],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);
  private searchService = inject(SearchService);
  private navigationService = inject(MessageNavigationService);
  private channelService = inject(ChannelService);
  private dmService = inject(DmService);
  presenceService = inject(Presence);
  searchResults = this.searchService.results;
  showSearchResults = computed(() => this.searchService.isQueryValid() && this.isSearchOpen());
  isSearchOpen = signal(false);

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

  selectedAvatar = signal('');

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

  /** Opens the user-profile editing-menu. */
  editUserProfile() {
    this.selectedAvatar.set(this.currentUser()?.avatar ?? '');
    this.isEditingUser.set(true);
  }

  /** Closes the user-profile editing-menu. */
  cancelUserProfileEdit() {
    this.selectedAvatar.set('');
    this.isEditingUser.set(false);
  }

  selectAvatar(avatar: string) {
    this.selectedAvatar.set(avatar);
  }

  /**
   * Saves changes to the signed-in user's display name and/or avatar, then leaves edit mode.
   * Does nothing if nobody is signed in or the trimmed name is empty.
   *
   * @param newName The raw value from the name input; it is trimmed before use.
   */
  async saveProfileChanges(newName: string) {
    const currentUser = this.currentUser();
    if (!currentUser) return;

    const trimmedName = newName.trim();
    if (trimmedName === '') return;

    const nameChanged = trimmedName !== currentUser.name;
    const avatarChanged =
      this.selectedAvatar() !== currentUser.avatar && this.selectedAvatar() !== '';

    if (nameChanged) {
      await this.userService.editUserName(currentUser.uid, trimmedName);
    }
    if (avatarChanged) {
      await this.userService.editUserAvatar(currentUser.uid, this.selectedAvatar());
    }

    this.isEditingUser.set(false);
  }

  /** Handles changes to the global search field. */
  onSearchInput(): void {
    this.searchService.setQuery(this.searchQuery);
    this.isSearchOpen.set(true);
  }

  closeSearchResult() {
    this.isSearchOpen.set(false);
  }

  async logout(): Promise<void> {
    void this.presenceService.goOffline().catch((error) => {
      console.error('Failed to set presence offline during logout.', error);
    });

    const currentUser = this.currentUser();
    const isGuest = this.authService.isCurrentUserAnonymous;

    if (isGuest && currentUser) {
      try {
        await Promise.all([
          this.channelService.deleteGuestMessages(currentUser.uid),
          this.dmService.deleteGuestMessages(currentUser.uid),
        ]);
        await this.channelService.removeGuestFromChannels(currentUser.uid);
      } catch (error) {
        console.error('Failed to delete guest content during logout.', error);
      }
      await this.userService.deleteUserProfile(currentUser.uid);
      await this.authService.deleteCurrentUser();
    } else {
      await this.authService.logout();
    }

    await this.router.navigateByUrl('/login');
  }

  openChannelResult(channel: Channel): void {
    this.channelService.selectChannel(channel.id);
    this.resetSearch();
  }

  openMessageResult(result: MessageSearchResult): void {
    if (!result.message.id) return;
    if (result.source === 'channel') {
      this.navigationService.goToChannelMessage(result.conversationId, result.message.id);
    } else {
      this.navigationService.goToDmMessage(result.conversationId, result.message.id);
    }
    this.resetSearch();
  }

  private resetSearch(): void {
    this.searchService.clear();
    this.searchQuery = '';
    this.closeSearchResult();
  }

  onSearchFocus(): void {
    if (this.searchService.isQueryValid()) {
      this.isSearchOpen.set(true);
    }
  }

  async openUserResult(user: UserModel): Promise<void> {
    await this.dmService.openDmWith(user.uid);
    this.resetSearch();
  }
}
