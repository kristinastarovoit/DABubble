/** Applies whichever of the four channel/DM add/remove reaction calls fits the
 * message's origin and its current reaction state. */
export async function toggleReaction(
  channelId: string | undefined,
  dmId: string | undefined,
  alreadyReacted: boolean,
  actions: {
    channelAdd: (channelId: string) => Promise<void>;
    channelRemove: (channelId: string) => Promise<void>;
    dmAdd: (dmId: string) => Promise<void>;
    dmRemove: (dmId: string) => Promise<void>;
  },
): Promise<void> {
  if (channelId) {
    await (alreadyReacted ? actions.channelRemove(channelId) : actions.channelAdd(channelId));
  } else if (dmId) {
    await (alreadyReacted ? actions.dmRemove(dmId) : actions.dmAdd(dmId));
  }
}
