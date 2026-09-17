import { Timestamp } from "firebase/firestore";

export interface Message {
    createdAt: Timestamp,
    senderId: string,
    text: string,
    threadCount?: number,
    reactions?: Record<string, string[]>;
}


/** Represents a chat or thread message. */
// export interface Message {
//     /** Unique message identifier. */
//     id: string;
//     /** Parent channel identifier. */
//     channelId?: string;
//     /** Direct-message conversation identifier. */
//     directMessageId?: string;
//     /** Parent thread message identifier. */
//     threadParentId?: string;

//     /** Message author identifier. */
//     authorId: string;
//     /** Message author display name. */
//     authorName: string;
//     /** Message author avatar URL. */
//     authorAvatarUrl: string;

//     /** Message body. */
//     text: string;
//     /** Message creation timestamp. */
//     createdAt: Date;
//     /** Formatted message time. */
//     time: string;
//     /** Last edit timestamp. */
//     editedAt?: Date;

//     /** Reactions attached to the message. */
//     // Zuweisung funktioniert so nicht in Firebase
//     // reactions: MessageReaction[];


//     /** Number of replies in the message thread. */
//     replyCount: number;
//     /** Timestamp of the latest reply. */
//     lastReplyAt?: string;
// }

/** Represents an emoji reaction on a message. */
export interface MessageReaction {
    /** Reaction emoji. */
    emoji: string;
    /** Number of users who selected the reaction. */
    count: number;
    /** Identifiers of users who selected the reaction. */
    userIds: string[];
    /** Whether the current user selected the reaction. */
    reactedByCurrentUser: boolean;
}
