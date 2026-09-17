import { Timestamp } from "firebase/firestore";

export interface Dm {
    id: string,
    memberIds: string[],
    lastMessageAt: Timestamp
}
