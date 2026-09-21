import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CURATED_EMOJIS } from '../../../shared/utilities/emoji-set';

/** Fixed set of quick-reaction emojis shown in the picker. */
const QUICK_REACTIONS = ['✅', '👍'] as const;

@Component({
  imports: [CommonModule],
  selector: 'app-reaction-picker',
  styleUrl: './reaction-picker.scss',
  templateUrl: './reaction-picker.html',
})
export class ReactionPicker {
  /** The fixed quick-reaction emojis. */
  protected readonly quickReactions = QUICK_REACTIONS;

  /** Emitted when a quick-reaction emoji is chosen. */
  reactionSelected = output<string>();

  /** Emitted when the full emoji picker should open. */
  moreEmojisRequested = output<void>();

  /** Emitted when the user wants to reply in a thread. */
  threadRequested = output<void>();

  /** Whether the extended emoji panel is currently open. */
  showFullPicker = signal(false);

  /** Opens the extended emoji panel instead of emitting immediately. */
  openFullPicker(): void {
    this.showFullPicker.set(true);
  }

  /** Selects an emoji from the extended panel and closes it. */
  selectFromFullPicker(emoji: string): void {
    this.reactionSelected.emit(emoji);
    this.showFullPicker.set(false);
  }

  /** Whether the current user is the author of this message (enables the edit menu). */
  isOwnMessage = input(false);

  /** Emitted when the message edit/delete menu should open. */
  moreActionsRequested = output<void>();

  /** Whether the "edit message" tooltip is currently shown. */
  showEditTooltip = signal(false);

  /** The curated set of emojis shown in the extended picker panel. */
  protected readonly curatedEmojis = CURATED_EMOJIS;
}
