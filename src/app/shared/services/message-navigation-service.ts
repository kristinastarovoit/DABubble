import { inject, Service, signal } from '@angular/core';
import { ChannelService } from './channel-service';
import { DmService } from './dm-service';

/** Navigates to a conversation and tracks the message to bring into view. */
@Service()
export class MessageNavigationService {
  /** Selects channels when navigating to a channel message. */
  private channelService = inject(ChannelService);

  /** Selects direct messages when navigating to a direct-message message. */
  private dmService = inject(DmService);

  /** ID of the message that the active conversation should scroll to, if any. */
  pendingMessageId = signal<string | undefined>(undefined);

  /**
   * Selects a channel and marks a message in it for navigation.
   *
   * @param channelId The ID of the channel to open.
   * @param messageId The ID of the message to bring into view.
   */
  goToChannelMessage(channelId: string, messageId: string): void {
    this.channelService.selectChannel(channelId);
    this.pendingMessageId.set(messageId);
  }

  /**
   * Selects a direct message and marks a message in it for navigation.
   *
   * @param dmId The ID of the direct-message conversation to open.
   * @param messageId The ID of the message to bring into view.
   */
  goToDmMessage(dmId: string, messageId: string): void {
    this.dmService.selectDm(dmId);
    this.pendingMessageId.set(messageId);
  }
}
