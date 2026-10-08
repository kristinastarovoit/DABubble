import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../shared/services/auth';
import { UserService } from '../../shared/services/users';
import { Router } from '@angular/router';

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
  isUserMenuOpen = false;

  /** Whether the user-profile-menu is visible. */
  isUserProfileOpen = false;

  isEditingUser = signal(false);

  /** Toggles the user menu. */
  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  /** Closes the user menu. */
  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  /** Opens the user-profile menu. */
  openUserProfile() {
    this.isUserProfileOpen = true;
  }

  /** Closes the user-profile menu. */
  closeUserProfile() {
    this.isUserProfileOpen = false;
  }

  /** Opens the user-profile editing-menu. */
  editUserProfile() {
    this.isEditingUser.set(true);
  }

  /** Closes the user-profile editing-menu. */
  cancelUserProfileEdit() {
    this.isEditingUser.set(false);
  }

  /**
 * Saves a new display name for the signed-in user and leaves edit mode.
 * Does nothing if nobody is signed in or the trimmed name is empty.
 * If the name is unchanged, edit mode is closed without writing to Firestore.
 *
 * @param newName The raw value from the name input; it is trimmed before use.
 */
  async saveNewUserName(newName: string) {
    const currentUser = this.currentUser();
    if (!currentUser) return;

    const trimmed = newName.trim();
    if (trimmed == '') return;
    if (trimmed === currentUser.name) {
      this.isEditingUser.set(false);
      return;
    }
    await this.userService.editUserName(currentUser.uid, trimmed);
    this.isEditingUser.set(false);
  }

  /** Handles changes to the global search field. */
  onSearchInput(): void { }


  /** Signs the current user out. */
  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
