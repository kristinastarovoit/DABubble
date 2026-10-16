import { Component, ElementRef, HostListener, inject, input, output, signal, viewChild} from '@angular/core';
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
  /** Reference to the host element to detect clicks outside the picker. */
  private elementRef = inject(ElementRef<HTMLElement>);

  /** Reference to the "more actions" menu element, used to detect viewport overflow. */
  private moreMenuRef = viewChild<ElementRef<HTMLElement>>('moreMenuRef');

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

  /** Whether the current user is the author of this message and can edit it. */
  isOwnMessage = input(false);

  showThreadIcon = input(true);

  showQuickReactions = input(true);

  /** Emitted when the message edit/delete menu should open. */
  moreActionsRequested = output<void>();

  /** Whether the "more actions" menu (Edit message, ...) is currently open. */
  showMoreMenu = signal(false);

  /** Whether the "more actions" menu should open leftward because it would otherwise overflow the viewport. */
  menuFlipped = signal(false);

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
    this.menuFlipped.set(false);
  }

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

  /** Opens or closes the "more actions" menu, checking afterwards whether it fits the viewport. */
  toggleMoreMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showMoreMenu.update((open) => !open);

    if (this.showMoreMenu()) {
      // Menu just opened — wait a tick for it to render, then measure it.
      setTimeout(() => this.checkMenuPosition());
    } else {
      this.menuFlipped.set(false);
    }
  }

  /** Flips the "more actions" menu to open leftward if it overflows its visible container. */
  private checkMenuPosition(): void {
    const el = this.moreMenuRef()?.nativeElement;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const boundary = this.getClippingBoundaryRight(el);
    this.menuFlipped.set(rect.right > boundary);
  }

  /**
   * Finds the right edge of the nearest ancestor that actually clips its content
   * (overflow hidden/auto/scroll on either axis) — e.g. the resizable chat panel —
   * falling back to the viewport width if none is found.
   */
  private getClippingBoundaryRight(el: HTMLElement): number {
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (
        /(auto|scroll|hidden)/.test(style.overflowX) ||
        /(auto|scroll|hidden)/.test(style.overflowY)
      ) {
        return node.getBoundingClientRect().right;
      }
      node = node.parentElement;
    }
    return window.innerWidth;
  }

  /** Handles the "Edit message" menu entry and closes the menu. */
  onEditMessage(): void {
    this.moreActionsRequested.emit();
    this.showMoreMenu.set(false);
    this.menuFlipped.set(false);
  }
}
