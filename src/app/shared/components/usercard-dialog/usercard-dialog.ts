import { Component, ViewChild, ElementRef, input, inject, output } from '@angular/core';
import { UserModel } from '../../model/user.model';
import { Presence } from '../../services/presence';

@Component({
  imports: [],
  selector: 'app-usercard-dialog',
  styleUrl: './usercard-dialog.scss',
  templateUrl: './usercard-dialog.html',
})
export class UsercardDialog {
  @ViewChild('profileCard') dialogRef!: ElementRef<HTMLDialogElement>;
  user = input<UserModel | undefined>(undefined);
  presenceService = inject(Presence);
  dmUser = output<UserModel>();

  /** Opens the user card dialog */
  openUserCard() {
    this.dialogRef.nativeElement.showModal();
  }

  /** Closes the user card dialog */
  closeUserCard() {
    this.dialogRef.nativeElement.close();
  }

  /** Closes the dialog only when the backdrop itself (not the card) was clicked. */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef.nativeElement) {
      this.closeUserCard();
    }
  }

  /**
   * Emits the displayed user so the parent can open a direct message with them,
   * then closes the dialog.
   * Does nothing if no user is set.
   */
  openDm() {
    const user = this.user();
    if (!user) return;
    this.dmUser.emit(user);
    this.closeUserCard();
  }
}
