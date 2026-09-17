import { Timestamp } from "firebase/firestore"

export interface ThreadMessage {
    id?: string,
    createdAt: Timestamp,
    reactions?: Record<string, string[]>,
    senderId: string,
    text: string
}
