import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChannelHeader } from './channel-header/channel-header';
import { MessageList } from './message-list/message-list';
import { MessageInput } from './message-input/message-input';
import { Message } from '../../shared/interfaces/message';
import { Channel } from '../../shared/interfaces/channel';

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

  /** Receives a message submitted in the input field. */
  sendMessage(text: string): void {
  }
}
