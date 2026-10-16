import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

/** Displays the legal notice and provides navigation back to the login page. */
@Component({
  imports: [],
  selector: 'app-legal-notice',
  styleUrl: './legal-notice.scss',
  templateUrl: './legal-notice.html',
})
export class LegalNotice {
  /** Navigates back to the login page. */
  private router = inject(Router);

  /** Navigates to the login page. */
  goToLogin() {
    this.router.navigateByUrl('/login');
  }
}
