import { Component, signal } from '@angular/core';
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
}
