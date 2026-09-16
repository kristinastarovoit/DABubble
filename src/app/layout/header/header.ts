import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../shared/interfaces/user';



@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {

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

  /** Closes the user menu. */
  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  /** Handles changes to the global search field. */
  onSearchInput(): void {
  }

  /** Navigates to the user profile. */
  goToProfile(): void { }

  /** Signs the current user out. */
  logout(): void { }
}

