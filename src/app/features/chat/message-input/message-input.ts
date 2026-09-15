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
   @Input() placeholder = 'Nachricht schreiben';
  @Output() messageSent = new EventEmitter<string>();

  text = '';

  send(): void {
    const trimmed = this.text.trim();
    if (!trimmed) return;
    this.messageSent.emit(trimmed);
    this.text = '';
  }

  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.send();
    }
  }

  toggleEmojiPicker(): void {
    // öffnet emoji-picker Komponente
  }

  insertMention(): void {
    this.text += '@';
  }
}
