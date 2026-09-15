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
  /** Reactions displayed by the component. */
  @Input() reactions: MessageReaction[] = [];
  /** Emitted when a reaction is toggled. */
  @Output() reactionToggled = new EventEmitter<string>();

  /** Toggles the selected emoji reaction. */
  toggle(emoji: string): void {
    this.reactionToggled.emit(emoji);
  }
}
