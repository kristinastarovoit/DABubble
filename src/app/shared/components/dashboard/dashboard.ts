import { Component, HostBinding, signal } from '@angular/core';
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
  sidebarOpen = signal(true);
  threadOpen = signal(true);

   isSidebarOpen = true;

  /** Mobile only: whether the chat view (instead of the sidebar) is shown. */
  mobileChatOpen = signal(false);

  @HostBinding('class.mobile-chat-open') get chatOpenClass(): boolean {
    return this.mobileChatOpen();
  }

  onSidebarToggled(isOpen: boolean): void {
    this.isSidebarOpen = isOpen;
  }
}
