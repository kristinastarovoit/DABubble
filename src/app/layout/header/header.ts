import { Component, computed, inject } from '@angular/core';
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

  /** Current value of the global search field. */
  searchQuery = '';

  /** Whether the user menu is visible. */
  isUserMenuOpen = false;

  /** Toggles the user menu. */
  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  /** Closes the user menu. */
  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  /** Handles changes to the global search field. */
  onSearchInput(): void {}

  /** Navigates to the user profile. */
  goToProfile(): void {}

  /** Signs the current user out. */
  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
