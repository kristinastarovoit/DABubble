import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageReaction } from '../../../shared/interfaces/message';
import { UserService } from '../../../shared/services/users';
import { reactionTooltipName } from '../../../shared/utilities/reactions.utils';
import { CURATED_EMOJIS } from '../../../shared/utilities/emoji-set';

const MAX_VISIBLE_REACTIONS = 6;
@Component({
  imports: [CommonModule],
  selector: 'app-reaction-bar',
  styleUrl: './reaction-bar.scss',
  templateUrl: './reaction-bar.html',
})
export class ReactionBar {
  private userService = inject(UserService);

  /** Reactions displayed by the component. */
  reactions = input<MessageReaction[]>([]);

  /** ID of the currently logged-in user, used to build the tooltip text. */
  currentUserId = input.required<string>();

  /** Emitted when a reaction chip is clicked (toggle). */
  reactionToggled = output<string>();

  /** Emoji of the chip currently being hovered, or null if none. */
  hoveredEmoji = signal<string | null>(null);

  /** Toggles the selected emoji reaction. */
  toggle(emoji: string): void {
    this.reactionToggled.emit(emoji);
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
    return this.showAll() ? all : all.slice(0, MAX_VISIBLE_REACTIONS);
  });

  /** Number of reactions hidden behind the "x weitere" toggle. */
  hiddenCount = computed(() => {
    const total = this.reactions().length;
    return total > MAX_VISIBLE_REACTIONS ? total - MAX_VISIBLE_REACTIONS : 0;
  });

  /** Expands the reaction list to show all reactions. */
  expandAll(): void {
    this.showAll.set(true);
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
}
