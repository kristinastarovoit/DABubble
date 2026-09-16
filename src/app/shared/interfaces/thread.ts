import { Timestamp } from "firebase/firestore"

export interface ThreadMessage {
    createdAt: Timestamp,
    reactions?: Record<string, string[]>,
    senderId: string,
    text: string
}
