import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  output,
  inject,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CURATED_EMOJIS } from '../../../shared/utilities/emoji-set';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-message-input',
  styleUrl: './message-input.scss',
  templateUrl: './message-input.html',
})
/** Provides the input field and actions for composing messages. */
export class MessageInput {
  private elementRef = inject(ElementRef<HTMLElement>);

  /** Placeholder displayed in the message field. */
  @Input() placeholder = 'Write Message';

  /** Whether sending is currently disabled, e.g. while no recipient has been chosen yet. */
  @Input() disabled = false;

  /** Emitted when a non-empty message is submitted. */
  // @Output() messageSent = new EventEmitter<string>();

  /** Contains the current message draft. */
  text = signal('');

  /** Emits a trimmed message when it is submitted. */
  send = output<string>();

  /** Sends the message when Enter is pressed without Shift. */
  onEnter(event: Event): void {
    if (this.disabled) return;

    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.sendMessage();
    }
  }

  /** The curated set of emojis offered by the picker. */
  protected readonly curatedEmojis = CURATED_EMOJIS;

  /** Whether the emoji picker panel is currently open. */
  showEmojiPicker = signal(false);

  /** Opens or closes the emoji picker panel. */
  toggleEmojiPicker(): void {
    this.showEmojiPicker.update((open) => !open);
  }

  /** Appends the chosen emoji to the draft and closes the picker. */
  selectEmoji(emoji: string): void {
    this.text.set(this.text() + emoji);
    this.showEmojiPicker.set(false);
  }

  /** Closes the emoji picker when clicking anywhere outside the component. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showEmojiPicker() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.showEmojiPicker.set(false);
    }
  }

  /** Inserts the mention prefix into the message. */
  insertMention(): void {
    this.text.set(this.text() + '@');
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
  }
}
