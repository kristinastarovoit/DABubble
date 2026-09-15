import { Component, signal } from '@angular/core';
import { Header } from './layout/header/header';
import { Sidebar } from './layout/sidebar/sidebar';
import { Chat } from './features/chat/chat';
import { Thread } from './features/thread/thread';

@Component({
  selector: 'app-root',
  imports: [Header, Sidebar, Chat, Thread],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('dabubble');
}
