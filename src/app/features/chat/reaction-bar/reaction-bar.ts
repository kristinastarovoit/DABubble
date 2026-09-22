import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageReaction } from '../../../shared/interfaces/message';
import { UserService } from '../../../shared/services/users';
import { reactionTooltipName } from '../../../shared/utilities/reactions.utils';
import { CURATED_EMOJIS } from '../../../shared/utilities/emoji-set';

const DEFAULT_MAX_VISIBLE_REACTIONS = 6;

@Component({
  imports: [CommonModule],
  selector: 'app-reaction-bar',
  styleUrl: './reaction-bar.scss',
  templateUrl: './reaction-bar.html',
})
export class ReactionBar {
  private userService = inject(UserService);
  private elementRef = inject(ElementRef<HTMLElement>);

  /** Reactions displayed by the component. */
  reactions = input<MessageReaction[]>([]);

  /** ID of the currently logged-in user, used to build the tooltip text. */
  currentUserId = input.required<string>();

  /** Whether this reaction bar belongs to a message sent by the current user. */
  isOwnMessage = input(false);

  /** Number of reaction chips shown before collapsing the rest behind "x weitere". */
  maxVisible = input(DEFAULT_MAX_VISIBLE_REACTIONS);

  /** Emitted when a reaction chip is clicked (toggle). */
  reactionToggled = output<string>();

  /** Emoji of the chip currently being hovered, or null if none. */
  hoveredEmoji = signal<string | null>(null);

  /** Toggles the selected emoji reaction and collapses the bar back to its default view. */
  toggle(emoji: string): void {
    this.reactionToggled.emit(emoji);
    this.showAll.set(false);
  }

  /** Builds just the name portion of the tooltip (e.g. "Sofia Müller" or "Sofia Müller und Du"). */
  tooltipNameFor(reaction: MessageReaction): string {
    return reactionTooltipName(reaction.userIds, this.currentUserId(), (uid) =>
      this.userService.getUserName(uid),
    );
  }

  /** Whether all reactions are shown, or just the first MAX_VISIBLE_REACTIONS. */
  showAll = signal(false);

  /** The reactions currently visible, respecting the collapse limit. */
  visibleReactions = computed(() => {
    const all = this.reactions();
    return this.showAll() ? all : all.slice(0, this.maxVisible());
  });

  hiddenCount = computed(() => {
    const total = this.reactions().length;
    const max = this.maxVisible();
    return total > max ? total - max : 0;
  });

  /** Expands the reaction list to show all reactions. */
  expandAll(): void {
    this.showAll.set(true);
  }

  /** Collapses the reaction list back to the first MAX_VISIBLE_REACTIONS. */
  collapseAll(): void {
    this.showAll.set(false);
  }

  /** The curated set of emojis for adding a new reaction. */
  protected readonly curatedEmojis = CURATED_EMOJIS;

  /** Whether the "add reaction" emoji panel is currently open. */
  showEmojiPanel = signal(false);

  /** Selects an emoji from the panel and closes it. */
  selectEmoji(emoji: string): void {
    this.toggle(emoji);
    this.showEmojiPanel.set(false);
  }

  /** Opens or closes the "add reaction" emoji panel. */
  toggleEmojiPanel(event: MouseEvent): void {
    event.stopPropagation();
    this.showEmojiPanel.update((open) => !open);
  }

  /** Closes the emoji panel when clicking anywhere outside the component. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showEmojiPanel() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.showEmojiPanel.set(false);
    }
  }
}
