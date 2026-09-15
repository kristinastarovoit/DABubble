import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Channel } from '../../shared/interfaces/channel';
import { User } from '../../shared/interfaces/user';


@Component({
  imports: [CommonModule],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
export class Sidebar {
  /** Available workspace channels. */
  @Input() channels: Channel[] = [];
  /** Available direct-message contacts. */
  @Input() directMessages: User[] = [];
  /** Identifier of the active channel. */
  @Input() activeChannelId: string | null = null;
  /** Identifier of the active direct message. */
  @Input() activeDmId: string | null = null;

  /** Emitted when a channel is selected. */
  @Output() channelSelected = new EventEmitter<Channel>();
  /** Emitted when a direct-message contact is selected. */
  @Output() directMessageSelected = new EventEmitter<User>();
  /** Emitted when channel creation is requested. */
  @Output() channelCreateRequested = new EventEmitter<void>();
  /** Emitted when workspace editing is requested. */
  @Output() workspaceEditRequested = new EventEmitter<void>();

  isChannelsOpen = true;
  isDirectMessagesOpen = true;

  /** Toggles the channel section. */
  toggleChannels(): void {
    this.isChannelsOpen = !this.isChannelsOpen;
  }

  /** Toggles the direct-message section. */
  toggleDirectMessages(): void {
    this.isDirectMessagesOpen = !this.isDirectMessagesOpen;
  }

  /** Selects a channel. */
  selectChannel(channel: Channel): void {
    this.channelSelected.emit(channel);
  }

  /** Selects a direct-message contact. */
  selectDirectMessage(contact: User): void {
    this.directMessageSelected.emit(contact);
  }

  /** Requests creation of a channel. */
  openChannelCreate(): void {
    this.channelCreateRequested.emit();
  }

  /** Requests editing of the workspace. */
  openWorkspaceEdit(): void {
    this.workspaceEditRequested.emit();
  }
}
