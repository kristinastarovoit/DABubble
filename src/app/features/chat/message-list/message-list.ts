import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactionBar } from '../reaction-bar/reaction-bar';
import { Message, MessageReaction } from '../../../shared/interfaces/message';

/** Groups messages under a calendar date. */
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
    const groups = new Map<string, MessageGroup>();

    for (const message of this.messages) {
      const date = new Date(message.createdAt.toDate());
      const key = date.toISOString().slice(0, 10);
      let group = groups.get(key);

      if (!group) {
        group = {
          dateLabel: date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          }),
          messages: [],
        };
        groups.set(key, group);
      }

      group.messages.push(message);
    }

    return Array.from(groups.values());
  }

  /** Emits a changed reaction for a message. */
  onReactionToggled(message: Message, emoji: string): void {
    this.reactionToggled.emit({ message, emoji });
  }
}
