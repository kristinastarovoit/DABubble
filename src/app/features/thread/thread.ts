import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageInput } from '../chat/message-input/message-input';
import { ReactionBar } from '../chat/reaction-bar/reaction-bar';
import { Message } from '../../shared/interfaces/message';

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
    const createdAt = new Date();
    const reply: Message = {
      id: `${createdAt.getTime()}`,
      channelId: this.parentMessage?.channelId,
      threadParentId: this.parentMessage?.id,
      authorId: 'current-user',
      authorName: 'Du',
      authorAvatarUrl: '',
      text,
      createdAt,
      time: createdAt.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      reactions: [],
      replyCount: 0,
    };

    this.replies = [...this.replies, reply];
    this.replySent.emit(text);
  }

  /** Emits a changed reaction for a reply. */
  onReactionToggled(reply: Message, emoji: string): void {
    this.reactionToggled.emit({ message: reply, emoji });
  }
}
