import { Component, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Channel } from '../../shared/interfaces/channel';
import { User } from '../../shared/interfaces/user';
import { UserModel } from '../../shared/model/user.model';
import { ChannelService } from '../../shared/services/channel-service';
import { DmService } from '../../shared/services/dm-service';
import { CreateChannel } from './create-channel/create-channel';
import { Dm } from '../../shared/interfaces/dm';

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

  /** Selects a direct-message conversation, creating it on first contact. */
  async selectDirectMessage(partner: {
    user: UserModel;
    isSelf: boolean;
    dm: Dm | null;
  }): Promise<void> {
    const currentUserId = this.dmService.currentUserId();
    if (!currentUserId) return;

    this.channelService.activeChannelId.set(undefined);
    if (partner.dm) {
      this.dmService.selectDm(partner.dm.id);
    } else {
      await this.dmService.addDm([currentUserId, partner.user.uid]);
    }
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
