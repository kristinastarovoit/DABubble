import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  input,
  computed,
  signal,
  effect,
} from '@angular/core';
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
import { DmHeader } from './dm-header/dm-header';
import { NewMessageService } from '../../shared/services/new-message-service';
import { ThreadService } from '../../shared/services/thread-service';

@Component({
  imports: [CommonModule, ChannelHeader, MessageInput, MessageList, LandingPage, DmHeader],
  selector: 'app-chat',
  styleUrl: './chat.scss',
  templateUrl: './chat.html',
})
export class Chat {
  private threadService = inject(ThreadService);

  openThread(message: Message): void {
    this.threadService.open(message, {
      channelId: this.channelId(),
      dmId: this.dmId(),
    });
  }

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

  /** Provides authentication state and current user data for the chat. */
  private authService = inject(AuthService);

  /** Tracks whether the "New Message" composer is active. */
  newMessageService = inject(NewMessageService);

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

  /** The ID of the currently authenticated user, if available. */
  uid = computed(() => this.auth.currentUser?.uid);

  /** The channel matching the currently selected channel ID. */
  activeChannel = computed(() =>
    this.channelService.channels().find((channel) => channel.id === this.channelId()),
  );

  /** The ID of the partner user matching the currently selected dm ID. */
  activeDmPartner = computed(() => {
    const dm = this.dmService.dms().find((dm) => dm.id === this.dmId());
    const partnerID = dm?.memberIds.find(
      (memberId) => memberId !== this.authService.currentUserId(),
    );
    return this.userService.users().find((user) => user.uid === partnerID);
  });

  /** Creates a reactive listener for the currently selected conversation. */
  constructor() {

    effect(() => {
      this.currentUnsubscribe?.();

      const channelId = this.channelId();
      const dmId = this.dmId();
      console.log('[Chat-Effect]', { channelId, dmId });

      if (dmId) {
        const { unsubscribe } = this.dmService.getMessages(dmId, (messages) =>
          this.messages.set(messages),
        );
        this.currentUnsubscribe = unsubscribe;
      } else if (channelId) {
        const { unsubscribe } = this.channelService.getMessages(channelId, (messages) =>
          this.messages.set(messages),
        );
        this.currentUnsubscribe = unsubscribe;
      } else {
        this.messages.set([]);
      }
    });
  }

  /** Removes the active Firestore message listener. */
  ngOnDestroy() {
    this.currentUnsubscribe?.();
  }

  /** Sends a message to the active channel or direct-message conversation. */
  onSend(text: string) {
    const uid = this.authService.currentUserId();
    if (!uid) {
      return;
    }

    const channelId = this.channelId();
    const dmId = this.dmId();

    if (dmId) {
      this.dmService.addMessageToDm(dmId, text, uid);
    } else if (channelId) {
      this.channelService.addMessageToChannel(channelId, text, uid);
    }
  }

  /** Saves inline-edited text to the active channel or DM conversation. */
  onEditSaved(event: { message: Message; text: string }) {
    const uid = this.authService.currentUserId();
    if (!uid) {
      return;
    }
    if (!event.message.id) {
      return;
    }

    const channelId = this.channelId();
    const dmId = this.dmId();

    if (dmId) {
      this.dmService.editDmMessage(dmId, event.message.id, event.text);
    } else if (channelId) {
      this.channelService.editChannelMessage(channelId, event.message.id, event.text);
    }
  }

  /** Toggles a reaction on a message in the active channel or direct-message conversation. */
  async onReactionToggled({ message, emoji }: { message: Message; emoji: string }): Promise<void> {
    const uid = this.uid();
    if (!uid || !message.id) return;

    const alreadyReacted = message.reactions?.[emoji]?.includes(uid) ?? false;
    const channelId = this.channelId();
    const dmId = this.dmId();

    if (channelId) {
      if (alreadyReacted) {
        await this.channelService.removeReactionFromChannelMessage(
          channelId,
          message.id,
          emoji,
          uid,
        );
      } else {
        await this.channelService.addReactionToChannelMessage(channelId, message.id, emoji, uid);
      }
    } else if (dmId) {
      if (alreadyReacted) {
        await this.dmService.removeReactionFromDmMessage(dmId, message.id, emoji, uid);
      } else {
        await this.dmService.addReactionToDmMessage(dmId, message.id, emoji, uid);
      }
    }
  }
}
