import { UserModel } from '../model/user.model';

/** Finds the user matching the given name for the "add member" flows in
 * channel-header and edit-channel, failing if there is no match or the user
 * is already a member. */
export function resolveMemberToAdd(
  query: string,
  users: UserModel[],
  memberIds: string[],
): { user: UserModel } | { errorMessage: string } {
  const matchedUser = users.find((user) => user.name.toLowerCase() === query.toLowerCase());
  if (!matchedUser) {
    return { errorMessage: 'No member with this name was found.' };
  }
  if (memberIds.includes(matchedUser.uid)) {
    return { errorMessage: 'This user is already a member of this channel.' };
  }
  return { user: matchedUser };
}
