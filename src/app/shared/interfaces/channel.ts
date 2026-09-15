
// Datenbank Schema:
// export interface Channel {
//     id: string,
//     name: string,
//     description: string,
//     createdBy: string,
//     memberIds: string[],
// }

/** Represents a workspace channel. */
export interface Channel {
    /** Unique channel identifier. */
    id: string;
    /** Channel display name. */
    name: string;
    /** Optional channel description. */
    description?: string;

    /** Identifier of the channel creator. */
    createdBy: string;


    /** Channel creation timestamp. */
    // nicht gebraucht
    // createdAt: Date;

    /** Identifiers of channel members. */
    memberIds: string[];

    /** Channel members with presence information. */
    // solch eine Verknüpfung funktioniert nicht in Firebase
    // members: ChannelMember[];
}

/** Represents a channel member. */
export interface ChannelMember {
    /** Unique user identifier. */
    id: string;
    /** User display name. */
    name: string;
    /** User avatar URL. */
    avatarUrl: string;
    /** Whether the user is currently online. */
    isOnline: boolean;
}
