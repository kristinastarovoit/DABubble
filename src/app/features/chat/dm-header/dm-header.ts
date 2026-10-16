import { Component, input, inject } from '@angular/core';
import { UserModel } from '../../../shared/model/user.model';
import { Presence } from '../../../shared/services/presence';
import { UsercardDialog } from '../../../shared/components/usercard-dialog/usercard-dialog';

@Component({
  imports: [UsercardDialog],
  selector: 'app-dm-header',
  styleUrl: './dm-header.scss',
  templateUrl: './dm-header.html',
})
export class DmHeader {
  presenceService = inject(Presence);
  currentDmPartner = input<UserModel | undefined>(undefined);

  /** Whether the displayed DM partner is the currently signed-in user. */
  isSelf = input(false);
}
