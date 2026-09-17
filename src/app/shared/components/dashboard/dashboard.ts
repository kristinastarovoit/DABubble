import { Component, inject } from '@angular/core';
import { Header } from '../../../layout/header/header';
import { Chat } from '../../../features/chat/chat';
import { Thread } from '../../../features/thread/thread';
import { Sidebar } from '../../../layout/sidebar/sidebar';
import { Channel } from '../../interfaces/channel';
import { User } from '../../interfaces/user';
import { FIREBASE_AUTH } from '../../../app.config';

@Component({
  imports: [Header, Chat, Thread, Sidebar],
  selector: 'app-dashboard',
  styleUrl: './dashboard.scss',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  /** The currently selected channel. */
  activeChannel: Channel | null = null;

  /** The currently selected direct-message conversation. */
  activeDmId: string | null = null;

  /** The display name of the selected direct-message contact. */
  activeDmName = '';

  private readonly auth = inject(FIREBASE_AUTH);

  /** The identifier of the signed-in user. */
  get currentUserId(): string {
    return this.auth.currentUser?.uid ?? '';
  }

  /** Activates a channel and clears the active direct message. */
  selectChannel(channel: Channel): void {
    this.activeChannel = channel;
    this.activeDmId = null;
    this.activeDmName = '';
  }

  /** Activates a direct-message conversation and clears the active channel. */
  selectDirectMessage(contact: User): void {
    this.activeChannel = null;
    this.activeDmId = contact.id;
    this.activeDmName = contact.name;
  }
}
