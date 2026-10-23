import {Component, afterRenderEffect, computed, ElementRef, inject, input, output, signal, viewChild} from '@angular/core';
import { toMessageReactions } from '../../../shared/utilities/reactions.utils';
import { ReactionPicker } from '../reaction-picker/reaction-picker';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactionBar } from '../reaction-bar/reaction-bar';
import { Message, MessageReaction } from '../../../shared/interfaces/message';
import { UserService } from '../../../shared/services/users';
import { ChannelService } from '../../../shared/services/channel-service';
import { AuthService } from '../../../shared/services/auth';
import { UserModel } from '../../../shared/model/user.model';
import { DmService } from '../../../shared/services/dm-service';
import { UsercardDialog } from '../../../shared/components/usercard-dialog/usercard-dialog';
import { MentionHighlightPipe } from '../../../shared/utilities/mention-highlight.pipe';
import { MessageNavigationService } from '../../../shared/services/message-navigation-service';
import { CURATED_EMOJIS } from '../../../shared/utilities/emoji-set';

/** Groups messages under a calendar date. */
interface MessageGroup {
  dateLabel: string;
  messages: Message[];
}

interface MentionOption {
  id: string;
  label: string;
  avatar?: string;
}

@Component({
  imports: [CommonModule, ReactionBar, DatePipe, ReactionPicker, UsercardDialog, MentionHighlightPipe],
  selector: 'app-message-list',
  styleUrl: './message-list.scss',
  templateUrl: './message-list.html',
})
export class MessageList {
  /** The curated set of emojis offered by the picker. */
  protected readonly curatedEmojis = CURATED_EMOJIS;

  /** Whether the emoji picker panel is currently open for the message being edited. */
  showEmojiPicker = signal(false);

  private userService = inject(UserService);
  private channelService = inject(ChannelService);
  private authService = inject(AuthService);
  private navigationService = inject(MessageNavigationService);
  private dmService = inject(DmService);
  selectedUser = signal<UserModel | undefined>(undefined);

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

  /** Trigger and query for the mention dropdown in the active inline editor. */
  mentionTrigger = signal<'@' | '#' | null>(null);
  private mentionStartIndex = signal<number | null>(null);
  private mentionQuery = signal('');
  activeMentionIndex = signal(0);
  private editTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('editTextarea');

  /** Users and channels matching the current inline-edit mention query. */
  mentionOptions = computed<MentionOption[]>(() => {
    const trigger = this.mentionTrigger();
    if (!trigger) return [];
    const query = this.mentionQuery().toLowerCase();
    const options: MentionOption[] =
      trigger === '@'
        ? this.userService
            .users()
            .filter((user) => user.uid !== this.authService.currentUserId())
            .map((user) => ({ id: user.uid, label: user.name, avatar: user.avatar }))
        : this.channelService.channels().map((channel) => ({ id: channel.id, label: channel.name }));
    return options.filter((option) => option.label.toLowerCase().includes(query));
  });

  showMentionDropdown = computed(
    () => this.mentionTrigger() !== null && this.mentionOptions().length > 0,
  );

  /** Resolves the reactions for a message, including the current user's own state. */
  protected messageReactions(message: Message): MessageReaction[] {
    return toMessageReactions(message.reactions, this.currentUserId());
  }

  /** The identifier of the message currently hovered by the pointer. */
  hoveredMessageId = signal<string | null>(null);

  private messageListElement = viewChild<ElementRef<HTMLDivElement>>('messageList');
  private shouldAutoScroll = true;
  private previousScrollKey: string | undefined;
  private hasRendered = false;

  constructor() {
    afterRenderEffect(() => this.syncScrollOnRender());
  }

  /** Opens or closes the emoji picker panel. */
  toggleEmojiPicker(): void {
    this.showEmojiPicker.update((open) => !open);
  }

  /** Appends the chosen emoji to the edit draft and closes the picker. */
  selectEmoji(emoji: string): void {
    this.editText.set(this.editText() + emoji);
    this.showEmojiPicker.set(false);
  }

  /** Inserts an @ at the caret and opens user suggestions in the inline editor. */
  insertMention(): void {
    const textarea = this.editTextarea()?.nativeElement;
    const value = this.editText();
    const caret = textarea?.selectionStart ?? value.length;
    this.editText.set(value.slice(0, caret) + '@' + value.slice(caret));
    this.openMentionDropdown('@', caret);
    this.updateEditTextarea(caret + 1);
  }

  /** Updates draft text and mention suggestions while the inline editor is being typed in. */
  onEditInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.editText.set(textarea.value);
    const beforeCaret = textarea.value.slice(0, textarea.selectionStart);
    const match = /(?:^|\s)([@#])([^\s@#]*)$/.exec(beforeCaret);
    if (!match) {
      this.closeMentionDropdown();
      return;
    }
    this.openMentionDropdown(match[1] as '@' | '#', beforeCaret.lastIndexOf(match[1]), match[2]);
  }

  /** Handles suggestion navigation or accepts the active suggestion from the inline editor. */
  onEditKeydown(event: KeyboardEvent, message: Message): void {
    if (this.showMentionDropdown()) {
      const options = this.mentionOptions();
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        this.activeMentionIndex.update(
          (index) => (index + direction + options.length) % options.length,
        );
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        this.selectMentionOption(options[this.activeMentionIndex()]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeMentionDropdown();
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.saveEditedMessage(message);
    }
  }

  /** Saves the active inline edit and closes its suggestion dropdown. */
  saveEditedMessage(message: Message): void {
    this.editSaved.emit({ message, text: this.editText() });
    this.editingMessageId.set(undefined);
    this.closeMentionDropdown();
  }

  /** Cancels the active inline edit and closes its suggestion dropdown. */
  cancelEditing(): void {
    this.editingMessageId.set(undefined);
    this.closeMentionDropdown();
  }

  /** Replaces the active trigger with the selected user or channel. */
  selectMentionOption(option: MentionOption): void {
    const trigger = this.mentionTrigger();
    const startIndex = this.mentionStartIndex();
    if (!trigger || startIndex === null) return;
    const insertion = `${trigger}${option.label} `;
    const endIndex = startIndex + 1 + this.mentionQuery().length;
    this.editText.set(
      this.editText().slice(0, startIndex) + insertion + this.editText().slice(endIndex),
    );
    this.closeMentionDropdown();
    this.updateEditTextarea(startIndex + insertion.length);
  }

  private openMentionDropdown(trigger: '@' | '#', startIndex: number, query = ''): void {
    this.mentionTrigger.set(trigger);
    this.mentionStartIndex.set(startIndex);
    this.mentionQuery.set(query);
    this.activeMentionIndex.set(0);
  }

  private closeMentionDropdown(): void {
    this.mentionTrigger.set(null);
    this.mentionStartIndex.set(null);
    this.mentionQuery.set('');
    this.activeMentionIndex.set(0);
  }

  private updateEditTextarea(caret: number): void {
    const textarea = this.editTextarea()?.nativeElement;
    if (!textarea) return;
    textarea.value = this.editText();
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  }

  /** Follows new messages or jumps to a pending navigation target after each render. */
  private syncScrollOnRender(): void {
    this.messages();
    const scrollKey = this.scrollKey();
    const element = this.messageListElement()?.nativeElement;
    if (!element) return;
    const isNewConversation = !this.hasRendered || scrollKey !== this.previousScrollKey;
    this.hasRendered = true;
    this.previousScrollKey = scrollKey;
    if (isNewConversation) this.shouldAutoScroll = true;
    if (this.scrollToPendingTarget(element)) return;
    if (this.shouldAutoScroll) element.scrollTop = element.scrollHeight;
  }

  /** Scrolls to and briefly highlights the pending navigation target, if any. */
  private scrollToPendingTarget(container: HTMLDivElement): boolean {
    const targetMessageId = this.navigationService.pendingMessageId();
    const targetElement = targetMessageId
      ? container.querySelector<HTMLElement>(`#message-${targetMessageId}`)
      : null;
    if (!targetElement) return false;
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetElement.classList.add('message-list__item--highlighted');
    setTimeout(() => targetElement.classList.remove('message-list__item--highlighted'), 2000);
    this.navigationService.pendingMessageId.set(undefined);
    return true;
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
    this.closeMentionDropdown();
  }

  /** Groups messages by their calendar date. */
  groupedMessages = computed<MessageGroup[]>(() => {
    const groups = new Map<string, MessageGroup>();
    for (const message of this.messages()) {
      if (!message.createdAt) continue;
      this.addToDateGroup(groups, message);
    }
    return Array.from(groups.values());
  });

  /** Adds a message to the group for its calendar date, creating the group if needed. */
  private addToDateGroup(groups: Map<string, MessageGroup>, message: Message): void {
    const date = message.createdAt!.toDate();
    const key = date.toISOString().slice(0, 10);
    if (!groups.has(key)) {
      const dateLabel = date.toLocaleDateString('en-EN', { weekday: 'long', month: 'long', day: 'numeric' });
      groups.set(key, { dateLabel, messages: [] });
    }
    groups.get(key)!.messages.push(message);
  }

  /** Emits a changed reaction for a message. */
  onReactionToggled(message: Message, emoji: string): void {
    this.reactionToggled.emit({ message, emoji });
  }

  /** Returns the display name for the given sender ID. */
  getSenderName(senderId: string): string {
    return this.userService.users().find((user) => user.uid === senderId)?.name ?? senderId;
  }

  /** Returns the display name for the given sender ID. */
  getSenderAvatar(senderId: string): string {
    return this.userService.users().find((user) => user.uid === senderId)?.avatar ?? senderId;
  }

  /** Returns the sender's user profile when it is available. */
  getSenderUser(senderId: string): UserModel | undefined {
    return this.userService.users().find((user) => user.uid === senderId);
  }

  /**
   * Opens the direct-message conversation with the selected message author.
   */
  async openDmWithUser(user: UserModel): Promise<void> {
    await this.dmService.openDmWith(user.uid);
  }
}
