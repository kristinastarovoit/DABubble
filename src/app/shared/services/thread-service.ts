import { Service, signal } from '@angular/core';
import { Message } from '../interfaces/message';

export interface ActiveThread {
  message: Message;
  channelId?: string;
  dmId?: string;
}

@Service()
export class ThreadService {
  activeThread = signal<ActiveThread | null>(null);

  open(message: Message, context: { channelId?: string; dmId?: string }): void {
    this.activeThread.set({ message, ...context });
  }

  close(): void {
    this.activeThread.set(null);
  }
}
