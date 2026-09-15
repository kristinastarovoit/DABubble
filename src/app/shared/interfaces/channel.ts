export interface Channel {
    id: string;
    name: string;
    description?: string;

    createdBy: string;
    createdAt: Date;

    memberIds: string[];
    members: ChannelMember[];
}

export interface ChannelMember {
    id: string;
    name: string;
    avatarUrl: string;
    isOnline: boolean;
}
