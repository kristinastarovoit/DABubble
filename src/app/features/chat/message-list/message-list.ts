import {
  Component,
  afterRenderEffect,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toMessageReactions } from '../../../shared/utilities/reactions.utils';
import { ReactionPicker } from '../reaction-picker/reaction-picker';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactionBar } from '../reaction-bar/reaction-bar';
import { Message, MessageReaction } from '../../../shared/interfaces/message';
import { UserService } from '../../../shared/services/users';
import { MentionHighlightPipe } from '../../../shared/utilities/mention-highlight.pipe';
import { MessageNavigationService } from '../../../shared/services/message-navigation-service';
import { CURATED_EMOJIS } from '../../../shared/utilities/emoji-set';

/** Groups messages under a calendar date. */
interface MessageGroup {
  dateLabel: string;
  messages: Message[];
}

@Component({
  imports: [CommonModule, ReactionBar, DatePipe, ReactionPicker, MentionHighlightPipe],
  selector: 'app-message-list',
  styleUrl: './message-list.scss',
  templateUrl: './message-list.html',
})
export class MessageList {
  /** The curated set of emojis offered by the picker. */
  protected readonly curatedEmojis = CURATED_EMOJIS;

  /** Whether the emoji picker panel is currently open for the message being edited. */
  showEmojiPicker = signal(false);

  /** Opens or closes the emoji picker panel. */
  toggleEmojiPicker(): void {
    this.showEmojiPicker.update((open) => !open);
  }

  /** Appends the chosen emoji to the edit draft and closes the picker. */
  selectEmoji(emoji: string): void {
    this.editText.set(this.editText() + emoji);
    this.showEmojiPicker.set(false);
  }

  private userService = inject(UserService);
  private navigationService = inject(MessageNavigationService);

  /** Messages displayed in the list. */
  messages = input<Message[]>([]);

  /** Identifies the conversation whose messages are displayed. */
  scrollKey = input<string | undefined>();

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

  private messageListElement = viewChild<ElementRef<HTMLDivElement>>('messageList');
  private shouldAutoScroll = true;
  private previousScrollKey: string | undefined;
  private hasRendered = false;

  constructor() {
    afterRenderEffect(() => {
      this.messages();
      const scrollKey = this.scrollKey();
      const element = this.messageListElement()?.nativeElement;
      if (!element) return;

      const isNewConversation = !this.hasRendered || scrollKey !== this.previousScrollKey;
      this.hasRendered = true;
      this.previousScrollKey = scrollKey;

      if (isNewConversation) this.shouldAutoScroll = true;

      const targetMessageId = this.navigationService.pendingMessageId();
      const targetElement = targetMessageId
        ? element.querySelector<HTMLElement>(`#message-${targetMessageId}`)
        : null;

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.classList.add('message-list__item--highlighted');
        (setTimeout(() => targetElement.classList.remove('message-list__item--highlighted'), 2000),
          this.navigationService.pendingMessageId.set(undefined));
        return;
      }

      if (this.shouldAutoScroll) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  /** Tracks whether the reader is close enough to the bottom to follow new messages. */
  onMessageListScroll(event: Event): void {
    const element = event.currentTarget as HTMLDivElement;
    this.shouldAutoScroll = element.scrollHeight - element.scrollTop - element.clientHeight <= 80;
  }

  /** Starts editing the provided message and preloads its content. */
  startEditing(message: Message) {
    this.editingMessageId.set(message.id);
    this.editText.set(message.text);
    this.showEmojiPicker.set(false);
  }

  /** Groups messages by their calendar date. */
  groupedMessages = computed<MessageGroup[]>(() => {
    const groups = new Map<string, MessageGroup>();

    for (const message of this.messages()) {
      if (!message.createdAt) {
        continue;
      }
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
    return this.userService.users().find((user) => user.uid === senderId)?.name ?? senderId;
  }

  /** Returns the display name for the given sender ID. */
  getSenderAvatar(senderId: string): string {
    return this.userService.users().find((user) => user.uid === senderId)?.avatar ?? senderId;
  }
}
