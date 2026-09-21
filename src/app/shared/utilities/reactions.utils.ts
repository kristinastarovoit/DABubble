import { MessageReaction } from '../interfaces/message';

/** Converts a message's raw Firestore reactions map into display-ready reaction objects. */
export function toMessageReactions(
  reactions: Record<string, string[]> | undefined,
  currentUserId: string,
): MessageReaction[] {
  if (!reactions) return [];

  return Object.entries(reactions)
    .map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
      reactedByCurrentUser: userIds.includes(currentUserId),
    }))
    .sort((a, b) => a.emoji.localeCompare(b.emoji));
}

export function reactionTooltipName(
  userIds: string[],
  currentUserId: string,
  getUserName: (uid: string) => string,
): string {
  const others = userIds.filter((id) => id !== currentUserId);
  const iReacted = userIds.includes(currentUserId);
  const firstName = getUserName(others[0] ?? currentUserId);

  if (userIds.length === 1) {
    return iReacted ? 'You' : firstName;
  }

  const remaining = others.length - 1;
  if (iReacted) {
    return remaining === 0 ? `${firstName} and you` : `${firstName}, you and +${remaining} `;
  }

  return remaining === 0
    ? `${firstName} and ${getUserName(others[1])}`
    : `${firstName} and +${remaining}`;
}
