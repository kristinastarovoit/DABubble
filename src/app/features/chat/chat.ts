import { Component, inject, computed, signal, effect, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChannelHeader } from './channel-header/channel-header';
import { MessageList } from './message-list/message-list';
import { MessageInput } from './message-input/message-input';
import { Message } from '../../shared/interfaces/message';
import { ChannelService } from '../../shared/services/channel-service';
import { DmService } from '../../shared/services/dm-service';
import { FIREBASE_AUTH } from '../../app.config';
import { UserService } from '../../shared/services/users';
import { AuthService } from '../../shared/services/auth';
import { DmHeader } from './dm-header/dm-header';
import { NewMessageService } from '../../shared/services/new-message-service';
import { ThreadService } from '../../shared/services/thread-service';
import { UsercardDialog } from '../../shared/components/usercard-dialog/usercard-dialog';
import { UserModel } from '../../shared/model/user.model';
import { Dm } from '../../shared/interfaces/dm';
import { toggleReaction } from '../../shared/utilities/reaction-toggle.utils';

@Component({
  imports: [CommonModule, ChannelHeader, MessageInput, MessageList, DmHeader, UsercardDialog],
  selector: 'app-chat',
  styleUrl: './chat.scss',
  templateUrl: './chat.html',
})
export class Chat {
  private threadService = inject(ThreadService);
  selectedUser = signal<UserModel | undefined>(undefined);

  @ViewChild('messageInput') private messageInputRef?: MessageInput;


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

  /** Whether the active conversation's initial messages have been received. */
  messagesLoaded = signal(false);

  /** Unsubscribes from the active message listener when the conversation changes. */
  private currentUnsubscribe: (() => void) | undefined;

  /** The ID of the currently authenticated user, if available. */
  uid = computed(() => this.auth.currentUser?.uid);

  /** The channel matching the currently selected channel ID. */
  activeChannel = computed(() =>
    this.channelService.channels().find((channel) => channel.id === this.channelId()),
  );

  isChannelMember = computed(() => {
    const channel = this.activeChannel();
    const uid = this.uid();
    if (!channel || !uid) return false;
    return channel.memberIds.includes(uid);
  });

  /** The user in the active DM, falling back to the current user for a self-DM. */
  activeDmPartner = computed(() => {
    const dm = this.dmService.dms().find((dm) => dm.id === this.dmId());
    const currentUserId = this.authService.currentUserId();
    const partnerId = dm?.memberIds.find((memberId) => memberId !== currentUserId);
    const userId = partnerId ?? (dm?.memberIds[0] === currentUserId ? currentUserId : undefined);
    return this.userService.users().find((user) => user.uid === userId);
  });

  /** Whether the active DM is a self-DM, as determined by the intro contact. */
  activeDmPartnerIsSelf = computed(() => this.activeDmIntroContact()?.isSelf ?? false);

  /** The contact profile and self-DM state used by the empty conversation intro. */
  activeDmIntroContact = computed(() => {
    const dm = this.dmService.dms().find((dm) => dm.id === this.dmId());
    const currentUserId = this.authService.currentUserId();
    if (!dm || !currentUserId) return undefined;
    return this.resolveIntroContact(dm, currentUserId);
  });

  /**
   * Opens the thread for a message in the currently active channel or direct message.
   *
   * @param message The message whose thread should be opened.
   */
  openThread(message: Message): void {
    this.threadService.open(message, {
      channelId: this.channelId(),
      dmId: this.dmId(),
    });
  }

  /** Closes the overlaid thread when focus returns to the chat composer. */
  onComposerFocus(): void {
    if (window.matchMedia('(min-width: 901px) and (max-width: 1350px)').matches) {
      this.threadService.close();
    }
  }

  /** Resolves the intro contact for a DM: the partner, or the user themself for a self-DM. */
  private resolveIntroContact(
    dm: Dm,
    currentUserId: string,
  ): { user: UserModel; isSelf: boolean } | undefined {
    const partnerId = dm.memberIds.find((memberId) => memberId !== currentUserId);
    if (partnerId) {
      const user = this.userService.users().find((candidate) => candidate.uid === partnerId);
      return user ? { user, isSelf: false } : undefined;
    }
    if (dm.memberIds.length === 1 && dm.memberIds[0] === currentUserId) {
      const user = this.userService.users().find((candidate) => candidate.uid === currentUserId);
      return user ? { user, isSelf: true } : undefined;
    }
    return undefined;
  }

  /** Creates a reactive listener for the currently selected conversation. */
  constructor() {
    effect(() => {
      this.currentUnsubscribe?.();
      this.messages.set([]);
      this.messagesLoaded.set(false);
      queueMicrotask(() => this.messageInputRef?.focusInput());
      this.currentUnsubscribe = this.subscribeToActiveConversation();
    });
  }

  /** Starts the message listener for whichever conversation (DM takes priority) is active. */
  private subscribeToActiveConversation(): (() => void) | undefined {
    const channelId = this.channelId();
    const dmId = this.dmId();
    const onMessages = (messages: Message[]) => {
      this.messages.set(messages);
      this.messagesLoaded.set(true);
    };
    if (dmId) return this.dmService.getMessages(dmId, onMessages).unsubscribe;
    if (channelId) return this.channelService.getMessages(channelId, onMessages).unsubscribe;
    return undefined;
  }

  /** Removes the active Firestore message listener. */
  ngOnDestroy() {
    this.currentUnsubscribe?.();
  }

  /**
   * Sends a message to the active direct message or, if the user is a member, channel.
   *
   * @param text The message text to send.
   */
  onSend(text: string): void {
    const uid = this.authService.currentUserId();
    if (!uid) return;
    const channelId = this.channelId();
    const dmId = this.dmId();
    if (dmId) {
      this.dmService.addMessageToDm(dmId, text, uid);
    } else if (channelId && this.isChannelMember()) {
      this.channelService.addMessageToChannel(channelId, text, uid);
    }
  }

  /** Saves inline-edited text to the active channel or DM conversation. */
  onEditSaved(event: { message: Message; text: string }): void {
    const uid = this.authService.currentUserId();
    const messageId = event.message.id;
    if (!uid || !messageId) return;
    const channelId = this.channelId();
    const dmId = this.dmId();
    if (dmId) {
      this.dmService.editDmMessage(dmId, messageId, event.text);
    } else if (channelId) {
      this.channelService.editChannelMessage(channelId, messageId, event.text);
    }
  }

  /** Toggles a reaction on a message in the active channel or direct-message conversation. */
  async onReactionToggled({ message, emoji }: { message: Message; emoji: string }): Promise<void> {
    const uid = this.uid();
    if (!uid || !message.id) return;
    const messageId = message.id;
    const alreadyReacted = message.reactions?.[emoji]?.includes(uid) ?? false;
    await toggleReaction(this.channelId(), this.dmId(), alreadyReacted, {
      channelAdd: (channelId) => this.channelService.addReactionToChannelMessage(channelId, messageId, emoji, uid),
      channelRemove: (channelId) => this.channelService.removeReactionFromChannelMessage(channelId, messageId, emoji, uid),
      dmAdd: (dmId) => this.dmService.addReactionToDmMessage(dmId, messageId, emoji, uid),
      dmRemove: (dmId) => this.dmService.removeReactionFromDmMessage(dmId, messageId, emoji, uid),
    });
  }
}
