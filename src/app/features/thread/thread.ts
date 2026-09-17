import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageInput } from '../chat/message-input/message-input';
import { ReactionBar } from '../chat/reaction-bar/reaction-bar';
import { Message, MessageReaction } from '../../shared/interfaces/message';
import { ThreadMessage } from '../../shared/interfaces/thread';
import { ChannelService } from '../../shared/services/channel-service';
import { DmService } from '../../shared/services/dm-service';
import { Timestamp } from 'firebase/firestore';

@Component({
  imports: [CommonModule, MessageInput, ReactionBar],
  selector: 'app-thread',
  styleUrl: './thread.scss',
  templateUrl: './thread.html',
})
export class Thread implements OnChanges, OnDestroy {

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

  /** Identifier of the direct-message conversation containing the thread. */
  @Input() dmId: string | null = null;

  /** Identifier of the channel containing the thread. */
  @Input() channelId: string | null = null;

  /** Emitted when the thread is closed. */
  @Output() closed = new EventEmitter<void>();

  /** Emitted when a reply is submitted. */
  @Output() replySent = new EventEmitter<string>();

  /** Emitted when a reaction on a reply changes. */
  @Output() reactionToggled = new EventEmitter<{ message: Message; emoji: string }>();

  private readonly dmService = inject(DmService, { optional: true });
  private readonly channelService = inject(ChannelService, { optional: true });
  private threadMessages = signal<ThreadMessage[]>([]);
  private hasLiveThread = false;
  private unsubscribeFromThread?: () => void;

  /** Starts the thread listener when the parent message or conversation changes. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['parentMessage'] || changes['dmId'] || changes['channelId']) {
      this.subscribeToThread();
    }
  }

  /** Removes the active thread listener when the component is destroyed. */
  ngOnDestroy(): void {
    this.unsubscribeFromThread?.();
  }

  /** Returns live backend replies or the input replies as a fallback. */
  get displayedReplies(): Message[] {
    return this.hasLiveThread ? this.threadMessages().map((threadMessage) => ({
      id: threadMessage.id,
      createdAt: threadMessage.createdAt,
      senderId: threadMessage.senderId,
      text: threadMessage.text,
      reactions: threadMessage.reactions,
    })) : this.replies;
  }

  /** Closes the thread. */
  close(): void {
    this.closed.emit();
  }

  /** Emits a new reply text. */
  async sendReply(text: string): Promise<void> {
    if (this.dmId && this.parentMessage?.id && this.dmService) {
      await this.dmService.addDmThread(this.dmId, this.parentMessage.id, text, this.currentUserId);
      this.replySent.emit(text);
      return;
    }

    if (this.channelId && this.parentMessage?.id && this.channelService) {
      await this.channelService.addChannelThread(this.channelId, this.parentMessage.id, text, this.currentUserId);
      this.replySent.emit(text);
      return;
    }

    const createdAt = Timestamp.now();
    const reply: Message = {
      id: `${createdAt.toMillis()}`,
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

  /** Adapts a Firestore reaction map to the reaction bar view model. */
  messageReactions(message: Message): MessageReaction[] {
    return Object.entries(message.reactions ?? {}).map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
      reactedByCurrentUser: userIds.includes(this.currentUserId),
    }));
  }

  /** Subscribes to replies for the active channel or direct-message thread. */
  private subscribeToThread(): void {
    this.unsubscribeFromThread?.();
    this.unsubscribeFromThread = undefined;
    this.hasLiveThread = false;
    this.threadMessages.set([]);

    const messageId = this.parentMessage?.id;
    if (!messageId) return;

    if (this.dmId && this.dmService) {
      const subscription = this.dmService.getThreads(this.dmId, messageId);
      this.threadMessages = subscription.threadMessage;
      this.hasLiveThread = true;
      this.unsubscribeFromThread = subscription.unsubscribe;
      return;
    }

    if (this.channelId && this.channelService) {
      const subscription = this.channelService.getThreads(this.channelId, messageId);
      this.threadMessages = subscription.threadMessage;
      this.hasLiveThread = true;
      this.unsubscribeFromThread = subscription.unsubscribe;
    }
  }
}
