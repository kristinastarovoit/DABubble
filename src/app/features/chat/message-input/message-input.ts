import { Component, Input, signal, computed, output, inject, ElementRef, ViewChild, HostListener} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CURATED_EMOJIS } from '../../../shared/utilities/emoji-set';
import { UserService } from '../../../shared/services/users';
import { ChannelService } from '../../../shared/services/channel-service';
import { AuthService } from '../../../shared/services/auth';
import { Presence } from '../../../shared/services/presence';

/** A single entry shown in the @/# mention dropdown. */
interface MentionOption {
  id: string;
  label: string;
  avatar?: string;
  status?: string;
  isDemoUser?: boolean;
}

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-message-input',
  styleUrl: './message-input.scss',
  templateUrl: './message-input.html',
})
/** Provides the input field and actions for composing messages. */
export class MessageInput {
  private elementRef = inject(ElementRef<HTMLElement>);
  private userService = inject(UserService);
  private channelService = inject(ChannelService);
  private authService = inject(AuthService);
  presenceService = inject(Presence);

  @ViewChild('textarea') private textareaRef?: ElementRef<HTMLTextAreaElement>;

  /** Moves keyboard focus into the message textarea. */
  focusInput(): void {
    this.textareaRef?.nativeElement.focus();
  }

  /** Placeholder displayed in the message field. */
  @Input() placeholder = 'Write Message';

  /** Whether the current user must join the channel before writing. */
  @Input() joinRequired = false;

  /** Whether sending is currently disabled, e.g. while no recipient has been chosen yet. */
  @Input() disabled = false;

  /** Emitted when a non-empty message is submitted. */
  // @Output() messageSent = new EventEmitter<string>();

  /** Contains the current message draft. */
  text = signal('');

  /** Emits a trimmed message when it is submitted. */
  send = output<string>();

  /** Emits when the message textarea receives focus. */
  composerFocused = output<void>();

  /** The curated set of emojis offered by the picker. */
  protected readonly curatedEmojis = CURATED_EMOJIS;

  /** Whether the emoji picker panel is currently open. */
  showEmojiPicker = signal(false);

  /** Which trigger character opened the mention dropdown, if any. */
  mentionTrigger = signal<'@' | '#' | null>(null);

  /** Index in the draft text where the current trigger character starts. */
  private mentionStartIndex = signal<number | null>(null);

  /** Text typed after the trigger character, used to filter the mention options. */
  private mentionQuery = signal('');

  /** Index of the currently highlighted mention option. */
  activeMentionIndex = signal(0);

  /** Opens or closes the emoji picker panel. */
  toggleEmojiPicker(): void {
    this.showEmojiPicker.update((open) => !open);
  }

  /** Inserts the chosen emoji at the caret, closes the picker and returns focus to the field. */
  selectEmoji(emoji: string): void {
    const textarea = this.textareaRef?.nativeElement;
    const value = this.text();
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);

    this.text.set(next);
    this.showEmojiPicker.set(false);
    if (!textarea) return;
    textarea.value = next;
    textarea.focus();
    textarea.setSelectionRange(start + emoji.length, start + emoji.length);
  }

  /** Closes the emoji picker when clicking anywhere outside the component. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showEmojiPicker() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.showEmojiPicker.set(false);
    }
    if (
      this.mentionTrigger() !== null &&
      !this.elementRef.nativeElement.contains(event.target as Node)
    ) {
      this.closeMentionDropdown();
    }
  }

  /** All users, excluding the currently logged-in one, as mention options. */
  private userMentionOptions = computed<MentionOption[]>(() => {
    const currentUserId = this.authService.currentUserId();
    return this.userService
      .users()
      .filter((user) => user.uid !== currentUserId)
      .map((user) => ({
        id: user.uid,
        label: user.name,
        avatar: user.avatar,
        status: user.status,
        isDemoUser: user.isDemoUser,
      }));
  });

  /** All channels as mention options. */
  private channelMentionOptions = computed<MentionOption[]>(() =>
    this.channelService.channels().map((channel) => ({ id: channel.id, label: channel.name })),
  );

  /** The mention options matching the current trigger and query text. */
  mentionOptions = computed<MentionOption[]>(() => {
    const trigger = this.mentionTrigger();
    if (!trigger) return [];

    const query = this.mentionQuery().toLowerCase();
    const options = trigger === '@' ? this.userMentionOptions() : this.channelMentionOptions();
    return options.filter((option) => option.label.toLowerCase().includes(query));
  });

  /** Whether the mention dropdown should currently be shown. */
  showMentionDropdown = computed(
    () => this.mentionTrigger() !== null && this.mentionOptions().length > 0,
  );

  /** Inserts the mention prefix and opens the mention dropdown. */
  insertMention(): void {
    const textarea = this.textareaRef?.nativeElement;
    const caret = textarea?.selectionStart ?? this.text().length;
    const value = this.text();

    this.text.set(value.slice(0, caret) + '@' + value.slice(caret));
    this.openMentionDropdown('@', caret);

    if (!textarea) return;
    textarea.value = this.text();
    textarea.focus();
    textarea.setSelectionRange(caret + 1, caret + 1);
  }

  /** Updates the draft text and re-evaluates whether the mention dropdown should be shown. */
  onInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.text.set(textarea.value);
    this.updateMentionState(textarea.value, textarea.selectionStart);
  }

  /** Detects an active @/# mention at the caret and updates the dropdown state accordingly. */
  private updateMentionState(value: string, caret: number): void {
    const textBeforeCaret = value.slice(0, caret);
    const match = /(?:^|\s)([@#])([^\s@#]*)$/.exec(textBeforeCaret);

    if (!match) {
      this.closeMentionDropdown();
      return;
    }

    const triggerIndex = textBeforeCaret.lastIndexOf(match[1]);
    this.openMentionDropdown(match[1] as '@' | '#', triggerIndex, match[2]);
  }

  /** Opens the mention dropdown for the given trigger character and query text. */
  private openMentionDropdown(trigger: '@' | '#', startIndex: number, query = ''): void {
    this.mentionTrigger.set(trigger);
    this.mentionStartIndex.set(startIndex);
    this.mentionQuery.set(query);
    this.activeMentionIndex.set(0);
  }

  /** Closes the mention dropdown and resets its state. */
  closeMentionDropdown(): void {
    this.mentionTrigger.set(null);
    this.mentionStartIndex.set(null);
    this.mentionQuery.set('');
    this.activeMentionIndex.set(0);
  }

  /** Replaces the active trigger and query text with the chosen mention option. */
  selectMentionOption(option: MentionOption): void {
    const trigger = this.mentionTrigger();
    const startIndex = this.mentionStartIndex();
    if (!trigger || startIndex === null) return;
    const value = this.text();
    const endIndex = startIndex + 1 + this.mentionQuery().length;
    const insertion = `${trigger}${option.label} `;
    this.text.set(value.slice(0, startIndex) + insertion + value.slice(endIndex));
    this.closeMentionDropdown();
    const textarea = this.textareaRef?.nativeElement;
    const caret = startIndex + insertion.length;
    queueMicrotask(() => textarea?.setSelectionRange(caret, caret));
    textarea?.focus();
  }

  /** Handles keyboard navigation within the mention dropdown. */
  onMentionKeydown(event: KeyboardEvent): boolean {
    if (!this.showMentionDropdown()) return false;
    const handled = this.handleMentionKey(event.key);
    if (handled) event.preventDefault();
    return handled;
  }

  /** Runs the action bound to a mention-dropdown key, if any, and reports whether it fired. */
  private handleMentionKey(key: string): boolean {
    const options = this.mentionOptions();
    const actions: Record<string, () => void> = {
      ArrowDown: () => this.activeMentionIndex.update((i) => (i + 1) % options.length),
      ArrowUp: () => this.activeMentionIndex.update((i) => (i - 1 + options.length) % options.length),
      Enter: () => this.selectMentionOption(options[this.activeMentionIndex()]),
      Tab: () => this.selectMentionOption(options[this.activeMentionIndex()]),
      Escape: () => this.closeMentionDropdown(),
    };
    const action = actions[key];
    if (!action) return false;
    action();
    return true;
  }

  /** Handles keydown events, delegating to mention navigation or sending the message. */
  onKeydown(event: KeyboardEvent): void {
    if (this.onMentionKeydown(event)) return;

    if (this.disabled) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /** Sends the trimmed message text. */
  sendMessage(): void {
    if (this.disabled) return;
    const value = this.text().trim();
    if (!value) {
      return;
    }
    this.send.emit(value);
    this.text.set('');
    this.closeMentionDropdown();
    this.focusInput();
  }
}
