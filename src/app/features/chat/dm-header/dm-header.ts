import { Component, input } from '@angular/core';
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
}
