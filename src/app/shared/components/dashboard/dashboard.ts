import { Component, HostBinding, inject, signal } from '@angular/core';
import { ThreadService } from '../../services/thread-service';
import { Header } from '../../../layout/header/header';
import { Chat } from '../../../features/chat/chat';
import { Thread } from '../../../features/thread/thread';
import { Sidebar } from '../../../layout/sidebar/sidebar';

/** Arranges the application header, sidebar, chat, and thread views. */
@Component({
  imports: [Header, Chat, Thread, Sidebar],
  selector: 'app-dashboard',
  styleUrl: './dashboard.scss',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  /** Controls the active thread panel. */
  private threadService = inject(ThreadService);

  /** Whether the sidebar is open. */
  sidebarOpen = signal(true);

  /** Whether the thread panel is open. */
  threadOpen = signal(true);

  /** Whether the sidebar is open, as reported by the sidebar component. */
  isSidebarOpen = true;

  /** Mobile only: whether the chat view (instead of the sidebar) is shown. */
  mobileChatOpen = signal(false);

  /** Adds the mobile chat-open host class when the chat view is active. */
  @HostBinding('class.mobile-chat-open') get chatOpenClass(): boolean {
    return this.mobileChatOpen();
  }

  /** Closes thread and chat to return to the sidebar (mobile). */
  closeChat(): void {
    this.threadService.close();
    this.mobileChatOpen.set(false);
  }

  /** Updates the sidebar state when the sidebar component toggles it. */
  onSidebarToggled(isOpen: boolean): void {
    this.isSidebarOpen = isOpen;
  }
}
