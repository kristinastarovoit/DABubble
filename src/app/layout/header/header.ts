import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../shared/interfaces/user';
import { AuthService } from '../../shared/services/auth';
import { Router } from '@angular/router';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {
  private authService = inject(AuthService);
  private router = inject(Router);

  /** The currently signed-in user. */
  currentUser!: User;

  /** Current value of the global search field. */
  searchQuery = '';

  /** Whether the user menu is visible. */
  isUserMenuOpen = false;

  /** Toggles the user menu. */
  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
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
