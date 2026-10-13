import { inject, Service, signal } from '@angular/core';
import { ChannelService } from './channel-service';
import { DmService } from './dm-service';

@Service()
export class MessageNavigationService {
  private channelService = inject(ChannelService);
  private dmService = inject(DmService);

  pendingMessageId = signal<string | undefined>(undefined);

  goToChannelMessage(channelId: string, messageId: string): void {
    this.channelService.selectChannel(channelId);
    this.pendingMessageId.set(messageId);
  }

  goToDmMessage(dmId: string, messageId: string): void {
    this.dmService.selectDm(dmId);
    this.pendingMessageId.set(messageId);
  }
}
