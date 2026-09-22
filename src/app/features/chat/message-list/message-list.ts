import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { toMessageReactions } from '../../../shared/utilities/reactions.utils';
import { ReactionPicker } from '../reaction-picker/reaction-picker';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactionBar } from '../reaction-bar/reaction-bar';
import { Message, MessageReaction } from '../../../shared/interfaces/message';
import { UserService } from '../../../shared/services/users';

/** Groups messages under a calendar date. */
interface MessageGroup {
  dateLabel: string;
  messages: Message[];
}

@Component({
  imports: [CommonModule, ReactionBar, DatePipe, ReactionPicker],
  selector: 'app-message-list',
  styleUrl: './message-list.scss',
  templateUrl: './message-list.html',
})
export class MessageList {
  /** Messages displayed in the list. */
  // @Input() messages: Message[] = [];

  // /** The identifier of the signed-in user. */
  // @Input() currentUserId = '';

  // /** Emitted when a message thread is opened. */
  // @Output() threadOpened = new EventEmitter<Message>();

  // /** Emitted when a message reaction changes. */
  // @Output() reactionToggled = new EventEmitter<{ message: Message; emoji: string }>();

  // /** Groups messages by their calendar date. */
  // get groupedMessages(): MessageGroup[] {
  //   const groups = new Map<string, MessageGroup>();

  //   for (const message of this.messages) {
  //     const date = new Date(message.createdAt.toDate());
  //     const key = date.toISOString().slice(0, 10);
  //     let group = groups.get(key);

  //     if (!group) {
  //       group = {
  //         dateLabel: date.toLocaleDateString('en-US', {
  //           weekday: 'long',
  //           month: 'long',
  //           day: 'numeric',
  //         }),
  //         messages: [],
  //       };
  //       groups.set(key, group);
  //     }

  //     group.messages.push(message);
  //   }

  //   return Array.from(groups.values());
  // }

  // /** Emits a changed reaction for a message. */
  // onReactionToggled(message: Message, emoji: string): void {
  //   this.reactionToggled.emit({ message, emoji });
  // }

  private userService = inject(UserService);

  /** Messages displayed in the list. */
  messages = input<Message[]>([]);

  /** The identifier of the signed-in user. */
  currentUserId = input('');

  /** Emitted when a message thread is opened. */
  threadOpened = output<Message>();

  /** Emitted when a message reaction changes. */
  reactionToggled = output<{ message: Message; emoji: string }>();

  /** Emitted after a message has been saved from inline editing. */
  editSaved = output<{ message: Message; text: string }>();

  /** The identifier of the message currently being edited. */
  editingMessageId = signal<string | undefined>(undefined);

  /** The current inline edit text for the active message. */
  editText = signal('');

  /** Starts editing the provided message and preloads its content. */
  startEditing(message: Message) {
    this.editingMessageId.set(message.id);
    this.editText.set(message.text);
  }

  /** Groups messages by their calendar date. */
  groupedMessages = computed<MessageGroup[]>(() => {
    const groups = new Map<string, MessageGroup>();

    for (const message of this.messages()) {
      if (!message.createdAt) { continue; }
      const date = message.createdAt.toDate();
      const key = date.toISOString().slice(0, 10);
      let group = groups.get(key);

      if (!group) {
        group = {
          dateLabel: date.toLocaleDateString('de-DE', {
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
  });

  /** Emits a changed reaction for a message. */
  onReactionToggled(message: Message, emoji: string): void {
    this.reactionToggled.emit({ message, emoji });
  }

  /** Resolves the reactions for a message, including the current user's own state. */
  protected messageReactions(message: Message): MessageReaction[] {
    return toMessageReactions(message.reactions, this.currentUserId());
  }

  /** The identifier of the message currently hovered by the pointer. */
  hoveredMessageId = signal<string | null>(null);

  /** Returns the display name for the given sender ID. */
  getSenderName(senderId: string): string {
    return this.userService.users().find(user => user.uid === senderId)?.name ?? senderId;
  }

  /** Returns the display name for the given sender ID. */
  getSenderAvatar(senderId: string): string {
    return this.userService.users().find(user => user.uid === senderId)?.avatar ?? senderId;
  }
}
