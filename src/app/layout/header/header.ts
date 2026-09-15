import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';



@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {
  // currentUser!: User; // TODO: Ergänzen aus entsprechendem Service
  searchQuery = '';
  isUserMenuOpen = false;

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  onSearchInput(): void {
    // TODO: SearchService o.ä.
  }

  goToProfile(): void { /* Router-Navigation */ }
  logout(): void { /* AuthService.logout() */ }
}

