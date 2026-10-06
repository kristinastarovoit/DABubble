import { Component, HostBinding, inject, signal } from '@angular/core';
import { ThreadService } from '../../services/thread-service';
import { Header } from '../../../layout/header/header';
import { Chat } from '../../../features/chat/chat';
import { Thread } from '../../../features/thread/thread';
import { Sidebar } from '../../../layout/sidebar/sidebar';

@Component({
  imports: [Header, Chat, Thread, Sidebar],
  selector: 'app-dashboard',
  styleUrl: './dashboard.scss',
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private threadService = inject(ThreadService);

  sidebarOpen = signal(true);
  threadOpen = signal(true);

   isSidebarOpen = true;

  /** Mobile only: whether the chat view (instead of the sidebar) is shown. */
  mobileChatOpen = signal(false);

  @HostBinding('class.mobile-chat-open') get chatOpenClass(): boolean {
    return this.mobileChatOpen();
  }

  /** Closes thread and chat to return to the sidebar (mobile). */
  closeChat(): void {
    this.threadService.close();
    this.mobileChatOpen.set(false);
  }

  onSidebarToggled(isOpen: boolean): void {
    this.isSidebarOpen = isOpen;
  }
}
