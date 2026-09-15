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

  @Input() activeChannel: Channel | null = null;
    @Input() messages: Message[] = [];

    @Output() threadRequested = new EventEmitter<Message>();
    @Output() memberListRequested = new EventEmitter<void>();

    openThread(message: Message): void {
      this.threadRequested.emit(message);
    }

  openMemberList(): void {
    this.memberListRequested.emit();
  }

  sendMessage(text: string): void {
    // an MessageService weiterleiten, z.B.:
    // this.messageService.send(this.activeChannel!.id, text);
  }
}
