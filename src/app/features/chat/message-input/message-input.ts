import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-message-input',
  styleUrl: './message-input.scss',
  templateUrl: './message-input.html',
})
export class MessageInput {

  /** Placeholder displayed in the message field. */
   @Input() placeholder = 'Write Message';

  /** Emitted when a non-empty message is submitted. */
  @Output() messageSent = new EventEmitter<string>();

  text = '';

  /** Sends the trimmed message text. */
  send(): void {
    const trimmed = this.text.trim();
    if (!trimmed) return;
    this.messageSent.emit(trimmed);
    this.text = '';
  }

  /** Sends the message when Enter is pressed without Shift. */
  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.send();
    }
  }

  /** Opens the emoji picker. */
  toggleEmojiPicker(): void {
  }

  /** Inserts the mention prefix into the message. */
  insertMention(): void {
    this.text += '@';
  }
}
