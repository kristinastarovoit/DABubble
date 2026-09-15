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
  @Input() channels: Channel[] = [];
  @Input() directMessages: User[] = [];
  @Input() activeChannelId: string | null = null;
  @Input() activeDmId: string | null = null;

  @Output() channelSelected = new EventEmitter<Channel>();
  @Output() directMessageSelected = new EventEmitter<User>();
  @Output() channelCreateRequested = new EventEmitter<void>();
  @Output() workspaceEditRequested = new EventEmitter<void>();

  isChannelsOpen = true;
  isDirectMessagesOpen = true;

  toggleChannels(): void {
    this.isChannelsOpen = !this.isChannelsOpen;
  }

  toggleDirectMessages(): void {
    this.isDirectMessagesOpen = !this.isDirectMessagesOpen;
  }

  selectChannel(channel: Channel): void {
    this.channelSelected.emit(channel);
  }

  selectDirectMessage(contact: User): void {
    this.directMessageSelected.emit(contact);
  }

  openChannelCreate(): void {
    this.channelCreateRequested.emit();
  }

  openWorkspaceEdit(): void {
    this.workspaceEditRequested.emit();
  }
}
