import { Component, input, ViewChild, ElementRef } from '@angular/core';
import { User } from '../../../shared/interfaces/user';
import { UserModel } from '../../../shared/model/user.model';

@Component({
  imports: [],
  selector: 'app-dm-header',
  styleUrl: './dm-header.scss',
  templateUrl: './dm-header.html',
})
export class DmHeader {
  currentDmPartner = input<UserModel | undefined>(undefined);
  @ViewChild('profileCard') dialogRef!: ElementRef<HTMLDialogElement>;

  openUserCard() {
    this.dialogRef.nativeElement.showModal();
  }

  closeUserCard() {
    this.dialogRef.nativeElement.close();
  }

  /** Closes the dialog only when the backdrop itself (not the card) was clicked. */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogRef.nativeElement) {
      this.closeUserCard();
    }
  }
}
