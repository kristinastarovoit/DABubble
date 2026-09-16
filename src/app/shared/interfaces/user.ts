/** Represents a workspace user. */
export interface User {
  /** Unique user identifier. */
    id: string;
  /** User display name. */
  name: string;
  /** User email address. */
  email: string;
  /** User avatar URL. */
  avatarUrl: string;

  /** Whether the user is currently online. */
  isOnline: boolean;
  /** Whether the user is the signed-in user. */
  isCurrentUser?: boolean;

  /** User creation timestamp. */
  createdAt: Date;
}
