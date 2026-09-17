import { Component, EventEmitter, Input, Output, inject, input, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChannelHeader } from './channel-header/channel-header';
import { MessageList } from './message-list/message-list';
import { MessageInput } from './message-input/message-input';
import { Message } from '../../shared/interfaces/message';
import { Channel } from '../../shared/interfaces/channel';
import { ChannelService } from '../../shared/services/channel-service';
import { DmService } from '../../shared/services/dm-service';
import { FIREBASE_AUTH } from '../../app.config';
import { LandingPage } from '../landing-page/landing-page';
@Component({
  imports: [CommonModule, ChannelHeader, MessageInput, MessageList, LandingPage],
  selector: 'app-chat',
  styleUrl: './chat.scss',
  templateUrl: './chat.html',
})
export class Chat {

  /** The currently selected channel. */
  // @Input() activeChannel: Channel | null = null;

  /** Messages displayed in the active channel. */
  // @Input() messages: Message[] = [];

  /** Emitted when a message thread is requested. */
  // @Output() threadRequested = new EventEmitter<Message>();

  /** Emitted when the channel member list is requested. */
  // @Output() memberListRequested = new EventEmitter<void>();

  /** Opens the thread for a message. */
  // openThread(message: Message): void {
  //   this.threadRequested.emit(message);
  // }

  /** Opens the active channel's member list. */
  // openMemberList(): void {
  //   this.memberListRequested.emit();
  // }

  private channelService = inject(ChannelService);
  private dmService = inject(DmService);
  private auth = inject(FIREBASE_AUTH);

  channelId = computed(() => this.channelService.activeChannelId());
  dmId = computed(() => this.dmService.activeDmId());

  messages = signal<Message[]>([]);
  private currentUnsubscribe: (() => void) | undefined;

  constructor() {
    effect(() => {
      this.currentUnsubscribe?.();

      const channelId = this.channelId();
      const dmId = this.dmId();

      if (channelId) {
        const { unsubscribe } = this.channelService.getMessages(
          channelId,
          messages => this.messages.set(messages)
        );
        this.currentUnsubscribe = unsubscribe;
      } else if (dmId) {
        const { unsubscribe } = this.dmService.getMessages(
          dmId,
          messages => this.messages.set(messages)
        );
        this.currentUnsubscribe = unsubscribe;
      }
    });
  }

  ngOnDestroy() {
    this.currentUnsubscribe?.();
  }

  onSend(text: string) {
    const uid = this.auth.currentUser?.uid;
    if (!uid) { return; }

    const channelId = this.channelId();
    const dmId = this.dmId();

    if (channelId) {
      this.channelService.addMessageToChannel(channelId, text, uid);
    } else if (dmId) {
      this.dmService.addMessageToDm(dmId, text, uid);
    }
  }


  /** Receives a message submitted in the input field. */
  // sendMessage(text: string): void {
  //   const createdAt = new Date();
  //   const message: Message = {
  //     id: `${createdAt.getTime()}`,
  //     channelId: this.activeChannel?.id,
  //     authorId: 'current-user',
  //     authorName: 'You',
  //     authorAvatarUrl: '',
  //     text,
  //     createdAt,
  //     time: createdAt.toLocaleTimeString('de-DE', {
  //       hour: '2-digit',
  //       minute: '2-digit',
  //     }),
  //     reactions: [],
  //     replyCount: 0,
  //   };

  //   this.messages = [...this.messages, message];
  // }
}
