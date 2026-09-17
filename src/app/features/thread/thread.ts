import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageInput } from '../chat/message-input/message-input';
import { ReactionBar } from '../chat/reaction-bar/reaction-bar';
import { Message, MessageReaction } from '../../shared/interfaces/message';
import { Timestamp } from 'firebase/firestore';

@Component({
  imports: [CommonModule, MessageInput, ReactionBar],
  selector: 'app-thread',
  styleUrl: './thread.scss',
  templateUrl: './thread.html',
})
export class Thread {

  /** Controls whether the thread is visible. */
  @Input() isVisible = true;

  /** The message that the thread belongs to. */
  @Input() parentMessage: Message | null = null;

  /** The name of the channel containing the thread. */
  @Input() channelName = '';

  /** The replies displayed in the thread. */
  @Input() replies: Message[] = [];

  /** The identifier of the signed-in user. */
  @Input() currentUserId = '';

  /** Emitted when the thread is closed. */
  @Output() closed = new EventEmitter<void>();

  /** Emitted when a reply is submitted. */
  @Output() replySent = new EventEmitter<string>();

  /** Emitted when a reaction on a reply changes. */
  @Output() reactionToggled = new EventEmitter<{ message: Message; emoji: string }>();

  /** Closes the thread. */
  close(): void {
    this.closed.emit();
  }

  /** Emits a new reply text. */
  sendReply(text: string): void {
    const createdAt = Timestamp.now();
    const reply: Message = {
      createdAt,
      senderId: this.currentUserId,
      text,
    };

    this.replies = [...this.replies, reply];
    this.replySent.emit(text);
  }

  /** Emits a changed reaction for a reply. */
  onReactionToggled(reply: Message, emoji: string): void {
    this.reactionToggled.emit({ message: reply, emoji });
  }

  /** Converts a Firestore reaction map for the reaction bar. */
  messageReactions(message: Message): MessageReaction[] {
    return Object.entries(message.reactions ?? {}).map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
      reactedByCurrentUser: userIds.includes(this.currentUserId),
    }));
  }
}
