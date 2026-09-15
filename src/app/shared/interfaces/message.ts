export interface Message {
    id: string;
    channelId?: string;
    directMessageId?: string;
    threadParentId?: string;

    authorId: string;
    authorName: string;
    authorAvatarUrl: string;

    text: string;
    createdAt: Date;
    time: string;
    editedAt?: Date;

    reactions: MessageReaction[];
    replyCount: number;
    lastReplyAt?: string;
}

export interface MessageReaction {
    emoji: string;
    count: number;
    userIds: string[];
    reactedByCurrentUser: boolean;
}
