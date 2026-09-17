import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChannelHeader } from './channel-header/channel-header';
import { MessageList } from './message-list/message-list';
import { MessageInput } from './message-input/message-input';
import { Message } from '../../shared/interfaces/message';
import { Channel } from '../../shared/interfaces/channel';
import { ChannelService } from '../../shared/services/channel-service';
import { FIREBASE_AUTH } from '../../app.config';

@Component({
  imports: [CommonModule, ChannelHeader, MessageInput, MessageList],
  selector: 'app-chat',
  styleUrl: './chat.scss',
  templateUrl: './chat.html',
})
export class Chat {

  /** The currently selected channel. */
  @Input() activeChannel: Channel | null = null;

  /** Messages displayed in the active channel. */
  @Input() messages: Message[] = [];

  /** The selected direct-message conversation. */
  @Input() activeDmId: string | null = null;

  /** The selected direct-message contact name. */
  @Input() activeDmName = '';

  /** The identifier of the signed-in user. */
  @Input() currentUserId = '';

  /** Emitted when a message thread is requested. */
  @Output() threadRequested = new EventEmitter<Message>();

  /** Emitted when the channel member list is requested. */
  @Output() memberListRequested = new EventEmitter<void>();

  /** Opens the thread for a message. */
  openThread(message: Message): void {
    this.threadRequested.emit(message);
  }

  /** Opens the active channel's member list. */
  openMemberList(): void {
    this.memberListRequested.emit();
  }

  private readonly channelService = inject(ChannelService);
  private readonly auth = inject(FIREBASE_AUTH);

  /** Returns the input messages for MessageList's backend-aware rendering. */
  get displayedMessages(): Message[] {
    return this.messages;
  }

  /** Resolves the current user ID when the template or send action needs it. */
  get effectiveUserId(): string {
    return this.auth.currentUser?.uid ?? this.currentUserId;
  }

  /** Stores a message in the active channel. */
  async sendMessage(text: string): Promise<void> {
    const senderId = this.effectiveUserId;
    if (!senderId) return;

    if (this.activeChannel) {
      await this.channelService.addMessageToChannel(this.activeChannel.id, text, senderId);
    }
  }

}
