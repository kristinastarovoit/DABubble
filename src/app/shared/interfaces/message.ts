import { Timestamp } from "firebase/firestore";

export interface Message {
    createdAt: Timestamp,
    senderId: string,
    text: string,
    threadCount?: number,
    reactions?: Record<string, string[]>;
}
