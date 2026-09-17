import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactionBar } from '../reaction-bar/reaction-bar';
import { Message, MessageReaction } from '../../../shared/interfaces/message';
import { DmService } from '../../../shared/services/dm-service';

/** Groups messages under a calendar date. */
interface MessageGroup {
  dateLabel: string;
  messages: Message[];
}

/** Displays channel messages or live direct-message messages. */
@Component({
  imports: [CommonModule, ReactionBar],
  selector: 'app-message-list',
  styleUrl: './message-list.scss',
  templateUrl: './message-list.html',
})
export class MessageList implements OnChanges, OnDestroy {
  /** Messages displayed in the list. */
  @Input() messages: Message[] = [];

  /** Loads direct-message messages when a conversation is selected. */
  @Input() dmId: string | null = null;

  /** The identifier of the signed-in user. */
  @Input() currentUserId = '';

  /** Emitted when a message thread is opened. */
  @Output() threadOpened = new EventEmitter<Message>();

  /** Emitted when a message reaction changes. */
  @Output() reactionToggled = new EventEmitter<{ message: Message; emoji: string }>();

  private readonly dmService = inject(DmService, { optional: true });
  private dmMessages = signal<Message[]>([]);
  private unsubscribeFromDm?: () => void;

  /** Updates the Firestore listener when the selected direct message changes. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dmId']) {
      this.subscribeToDirectMessages();
    }
  }

  /** Removes the active Firestore listener when the component is destroyed. */
  ngOnDestroy(): void {
    this.unsubscribeFromDm?.();
  }

  /** Uses live DM messages when a DM is active, otherwise the input messages. */
  get displayedMessages(): Message[] {
    return this.dmId ? this.dmMessages() : this.messages;
  }

  /** Groups messages by their calendar date. */
  get groupedMessages(): MessageGroup[] {
    const groups = new Map<string, MessageGroup>();

    for (const message of this.displayedMessages) {
      const date = message.createdAt?.toDate() ?? new Date();
      const key = message.createdAt ? date.toISOString().slice(0, 10) : 'pending';
      let group = groups.get(key);

      if (!group) {
        group = {
          dateLabel: message.createdAt ? date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          }) : 'Today',
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

  /** Adapts Firestore reaction maps to the reaction bar's view model. */
  messageReactions(message: Message): MessageReaction[] {
    return Object.entries(message.reactions ?? {}).map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
      reactedByCurrentUser: userIds.includes(this.currentUserId),
    }));
  }

  /** Starts a live message listener for the selected direct-message conversation. */
  private subscribeToDirectMessages(): void {
    this.unsubscribeFromDm?.();
    this.unsubscribeFromDm = undefined;
    this.dmMessages.set([]);

    if (!this.dmId || !this.dmService) {
      return;
    }

    const subscription = this.dmService.getMessages(this.dmId);
    this.dmMessages = subscription.messages;
    this.unsubscribeFromDm = subscription.unsubscribe;
  }
}
