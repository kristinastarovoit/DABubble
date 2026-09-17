import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DmService } from '../../../shared/services/dm-service';
import { FIREBASE_AUTH } from '../../../app.config';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-message-input',
  styleUrl: './message-input.scss',
  templateUrl: './message-input.html',
})
export class MessageInput {

  /** Placeholder displayed in the message field. */
  @Input() placeholder = 'Write Message';

  /** Identifier of the direct-message conversation. */
  @Input() dmId: string | null = null;

  /** Identifier of the user sending the direct message. */
  @Input() senderId = '';

  /** Emitted when a non-empty message is submitted. */
  @Output() messageSent = new EventEmitter<string>();

  /** Current message text. */
  text = '';

  private readonly dmService = inject(DmService, { optional: true });
  private readonly auth = inject(FIREBASE_AUTH);

  /** Sends the trimmed message text. */
  async send(): Promise<void> {
    const trimmed = this.text.trim();
    if (!trimmed) return;

    const senderId = this.senderId || this.auth.currentUser?.uid || '';

    if (this.dmId) {
      if (!senderId || !this.dmService) return;
      await this.dmService.addMessageToDm(this.dmId, trimmed, senderId);
    } else {
      this.messageSent.emit(trimmed);
    }

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
