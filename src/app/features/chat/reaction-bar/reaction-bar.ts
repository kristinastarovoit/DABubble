import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageReaction } from '../../../shared/interfaces/message';

@Component({
  imports: [CommonModule],
  selector: 'app-reaction-bar',
  styleUrl: './reaction-bar.scss',
  templateUrl: './reaction-bar.html',
})
export class ReactionBar {
  @Input() reactions: MessageReaction[] = [];
  @Output() reactionToggled = new EventEmitter<string>();

  toggle(emoji: string): void {
    this.reactionToggled.emit(emoji);
  }
}
