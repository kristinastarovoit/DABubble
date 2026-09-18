import { Component, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Channel } from '../../shared/interfaces/channel';
import { User } from '../../shared/interfaces/user';
import { ChannelService } from '../../shared/services/channel-service';
import { DmService } from '../../shared/services/dm-service';
import { CreateChannel } from './create-channel/create-channel';


@Component({
  imports: [CommonModule, CreateChannel],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
/** Displays channels and direct-message contacts in the application sidebar. */
export class Sidebar {
  /** Provides the available channels and channel selection state. */
  channelService = inject(ChannelService);

  /** Provides direct-message data and selection state. */
  dmService = inject(DmService);

  /** Reference to the create-channel dialog. */
  @ViewChild('createChannel') private createChannel!: CreateChannel;

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

  /** Whether the channels section is expanded. */
  isChannelsOpen = true;

  /** Whether the direct-messages section is expanded. */
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
  openChannelCreate(event?: Event): void {
    event?.stopPropagation();
    this.createChannel.open();
    this.channelCreateRequested.emit();
  }

  /** Requests editing of the workspace. */
  openWorkspaceEdit(): void {
    this.workspaceEditRequested.emit();
  }
}
