import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactionBar } from '../reaction-bar/reaction-bar';
import { Message, MessageReaction } from '../../../shared/interfaces/message';


interface MessageGroup {
  dateLabel: string;
  messages: Message[];
}

@Component({
  imports: [CommonModule, ReactionBar],
  selector: 'app-message-list',
  styleUrl: './message-list.scss',
  templateUrl: './message-list.html',
})
export class MessageList {
  /** Messages displayed in the list. */
   @Input() messages: Message[] = [];
  /** The identifier of the signed-in user. */
  @Input() currentUserId = '';

  /** Emitted when a message thread is opened. */
  @Output() threadOpened = new EventEmitter<Message>();
  /** Emitted when a message reaction changes. */
  @Output() reactionToggled = new EventEmitter<{ message: Message; emoji: string }>();

  /** Groups messages by their calendar date. */
  get groupedMessages(): MessageGroup[] {
    return [];
  }

  /** Emits a changed reaction for a message. */
  onReactionToggled(message: Message, emoji: string): void {
    this.reactionToggled.emit({ message, emoji });
  }
}
