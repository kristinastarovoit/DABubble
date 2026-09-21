import { Component, EventEmitter, Input, Output, inject, input, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChannelHeader } from './channel-header/channel-header';
import { MessageList } from './message-list/message-list';
import { MessageInput } from './message-input/message-input';
import { Message } from '../../shared/interfaces/message';
import { ChannelService } from '../../shared/services/channel-service';
import { DmService } from '../../shared/services/dm-service';
import { FIREBASE_AUTH } from '../../app.config';
import { LandingPage } from '../landing-page/landing-page';
import { UserService } from '../../shared/services/users';
import { AuthService } from '../../shared/services/auth';

@Component({
  imports: [CommonModule, ChannelHeader, MessageInput, MessageList, LandingPage],
  selector: 'app-chat',
  styleUrl: './chat.scss',
  templateUrl: './chat.html',
})
export class Chat {

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

  /** Provides channel data and channel message listeners. */
  private channelService = inject(ChannelService);

  /** Provides direct-message data and direct-message listeners. */
  private dmService = inject(DmService);

  /** Provides user data and user listeners. */
  private userService = inject(UserService);

  private authService = inject(AuthService);

  /** Provides the currently authenticated user for sending messages. */
  private auth = inject(FIREBASE_AUTH);

  /** Identifier of the currently selected channel. */
  channelId = computed(() => this.channelService.activeChannelId());

  /** Identifier of the currently selected direct-message conversation. */
  dmId = computed(() => this.dmService.activeDmId());

  /** Messages displayed for the active channel or direct-message conversation. */
  messages = signal<Message[]>([]);

  /** Unsubscribes from the active message listener when the conversation changes. */
  private currentUnsubscribe: (() => void) | undefined;

  uid = this.auth.currentUser?.uid;

  /** The channel matching the currently selected channel ID. */
  activeChannel = computed(() =>
    this.channelService.channels().find(channel => channel.id === this.channelId())
  );

  /** The ID of the partner user matching the currently selected dm ID. */
  activeDmPartner = computed(() => {
    const dm = this.dmService.dms().find(dm => dm.id === this.dmId());
    const partnerID = dm?.memberIds.find(memberId => memberId !== this.authService.currentUserId());
    return this.userService.users().find(user => user.uid === partnerID)
  }
  )

  /** Creates a reactive listener for the currently selected conversation. */
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

  /** Removes the active Firestore message listener. */
  ngOnDestroy() {
    this.currentUnsubscribe?.();
  }

  /** Sends a message to the active channel or direct-message conversation. */
  onSend(text: string) {
    if (!this.uid) { return; }

    const channelId = this.channelId();
    const dmId = this.dmId();

    if (channelId) {
      this.channelService.addMessageToChannel(channelId, text, this.uid);
    } else if (dmId) {
      this.dmService.addMessageToDm(dmId, text, this.uid);
    }
  }
}
