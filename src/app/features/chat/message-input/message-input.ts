import { Component, EventEmitter, Input, Output, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-message-input',
  styleUrl: './message-input.scss',
  templateUrl: './message-input.html',
})
/** Provides the input field and actions for composing messages. */
export class MessageInput {

  /** Placeholder displayed in the message field. */
  @Input() placeholder = 'Write Message';

  /** Emitted when a non-empty message is submitted. */
  // @Output() messageSent = new EventEmitter<string>();

  /** Contains the current message draft. */
  text = signal('');

  /** Emits a trimmed message when it is submitted. */
  send = output<string>();

  /** Sends the message when Enter is pressed without Shift. */
  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.sendMessage();
    }
  }

  /** Opens the emoji picker. */
  toggleEmojiPicker(): void {
  }

  /** Inserts the mention prefix into the message. */
  insertMention(): void {
    this.text.set(this.text() + '@');
  }

  /** Sends the trimmed message text. */
  sendMessage(): void {
    const value = this.text().trim();
    if (!value) { return; }

    this.send.emit(value);
    this.text.set('');
  }
}
