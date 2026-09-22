import { Component, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
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
  private elementRef = inject(ElementRef<HTMLElement>);

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

  /** Opens or closes the extended emoji panel. */
  toggleFullPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.showFullPicker.update((open) => !open);
  }

  /** Selects an emoji from the extended panel and closes it. */
  selectFromFullPicker(emoji: string): void {
    this.reactionSelected.emit(emoji);
    this.showFullPicker.set(false);
  }

  /** Whether the current user is the author of this message (enables the edit menu). */
  isOwnMessage = input(false);

  showThreadIcon = input(true);

  showQuickReactions = input(true);

  /** Emitted when the message edit/delete menu should open. */
  moreActionsRequested = output<void>();

  /** Whether the "more actions" menu (Edit message, ...) is currently open. */
  showMoreMenu = signal(false);

  /** Opens or closes the "more actions" menu. */
  toggleMoreMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showMoreMenu.update((open) => !open);
  }

  /** Handles the "Edit message" menu entry and closes the menu. */
  onEditMessage(): void {
    this.moreActionsRequested.emit();
    this.showMoreMenu.set(false);
  }

  /** The curated set of emojis shown in the extended picker panel. */
  protected readonly curatedEmojis = CURATED_EMOJIS;

  /** Closes any open popover when clicking anywhere outside the component. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.elementRef.nativeElement.contains(event.target as Node)) {
      return;
    }
    this.showFullPicker.set(false);
    this.showMoreMenu.set(false);
  }
}
