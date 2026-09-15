import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactionBar } from '../reaction-bar/reaction-bar';
import { Message, MessageReaction } from '../../../shared/interfaces/message';


interface MessageGroup {
  dateLabel: string;
  messages: Message[];
}

@Component({
  imports: [CommonModule, ReactionBar],
  selector: 'app-message-list',
  styleUrl: './message-list.scss',
  templateUrl: './message-list.html',
})
export class MessageList {
   @Input() messages: Message[] = [];
  @Input() currentUserId = '';

  @Output() threadOpened = new EventEmitter<Message>();
  @Output() reactionToggled = new EventEmitter<{ message: Message; emoji: string }>();

  get groupedMessages(): MessageGroup[] {
    // Gruppiert this.messages nach Tag und gibt "Heute"/"Dienstag, 14. Januar" zurück
    // Implementierung z.B. über eine Pipe (date-group.pipe.ts) auslagern
    return [];
  }

  onReactionToggled(message: Message, emoji: string): void {
    this.reactionToggled.emit({ message, emoji });
  }
}
