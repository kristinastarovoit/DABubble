import { Service, signal } from '@angular/core';
import { Message } from '../interfaces/message';

/** Conversation context for the message whose thread is open. */
export interface ActiveThread {
  /** The message that owns the thread. */
  message: Message;
  /** ID of the channel containing the message, if it is a channel message. */
  channelId?: string;
  /** ID of the direct-message conversation containing the message, if applicable. */
  dmId?: string;
}

/** Stores and manages the currently open message thread. */
@Service()
export class ThreadService {
  /** The active thread context, or `null` when no thread is open. */
  activeThread = signal<ActiveThread | null>(null);

  /**
   * Opens a thread for a message in a channel or direct-message conversation.
   *
   * @param message The message whose thread should be opened.
   * @param context The channel or direct-message conversation containing the message.
   */
  open(message: Message, context: { channelId?: string; dmId?: string }): void {
    this.activeThread.set({ message, ...context });
  }

  /** Closes the active thread. */
  close(): void {
    this.activeThread.set(null);
  }
}
