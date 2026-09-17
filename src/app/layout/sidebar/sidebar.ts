import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Channel } from '../../shared/interfaces/channel';
import { User } from '../../shared/interfaces/user';
import { ChannelService } from '../../shared/services/channel-service';
import { DmService } from '../../shared/services/dm-service';


@Component({
  imports: [CommonModule],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
export class Sidebar {
  channelService = inject(ChannelService);
  dmService = inject(DmService);
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
    this.channelService.selectChannel(channel.id);
    this.dmService.activeDmId.set(undefined);
    this.channelSelected.emit(channel);
  }

  /** Selects a direct-message contact. */
  selectDirectMessage(contact: User): void {
    this.dmService.selectDm(contact.id);
    this.channelService.activeChannelId.set(undefined);
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
