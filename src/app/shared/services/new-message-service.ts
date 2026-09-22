import { Service, signal } from '@angular/core';

@Service()
/** Tracks whether the "New Message" composer is currently active in the channel header. */
export class NewMessageService {
  /** Whether the "New Message" recipient picker is currently shown instead of the normal header. */
  isNewMessageMode = signal(false);

  /** Toggles the "New Message" mode on or off. */
  toggle(): void {
    this.isNewMessageMode.set(!this.isNewMessageMode());
  }

  /** Leaves the "New Message" mode, e.g. once a recipient has been chosen. */
  close(): void {
    this.isNewMessageMode.set(false);
  }
}
