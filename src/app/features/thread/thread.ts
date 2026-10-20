import { Component, ElementRef, afterRenderEffect, computed, effect, inject, signal, viewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageInput } from '../chat/message-input/message-input';
import { ReactionBar } from '../chat/reaction-bar/reaction-bar';
import { ReactionPicker } from '../chat/reaction-picker/reaction-picker';
import { Message, MessageReaction } from '../../shared/interfaces/message';
import { ThreadMessage } from '../../shared/interfaces/thread';
import { ThreadService, type ActiveThread } from '../../shared/services/thread-service';
import { ChannelService } from '../../shared/services/channel-service';
import { DmService } from '../../shared/services/dm-service';
import { AuthService } from '../../shared/services/auth';
import { UserService } from '../../shared/services/users';
import { UserModel } from '../../shared/model/user.model';
import { UsercardDialog } from '../../shared/components/usercard-dialog/usercard-dialog';
import { MentionHighlightPipe } from '../../shared/utilities/mention-highlight.pipe';
import { CURATED_EMOJIS } from '../../shared/utilities/emoji-set';
import { toggleReaction } from '../../shared/utilities/reaction-toggle.utils';

/** Displays a message thread, its replies, and related actions. */
@Component({
  imports: [CommonModule, MessageInput, ReactionBar, ReactionPicker, UsercardDialog, MentionHighlightPipe],
  selector: 'app-thread',
  styleUrl: './thread.scss',
  templateUrl: './thread.html',
})
export class Thread {
  /** Holds the currently opened thread. */
  private threadService = inject(ThreadService);

  /** Provides channel messages, replies and reactions. */
  private channelService = inject(ChannelService);

  /** Provides direct-message conversations, replies and reactions. */
  private dmService = inject(DmService);

  /** Provides the signed-in user. */
  private authService = inject(AuthService);

  /** Provides the list of known users. */
  private userService = inject(UserService);

  /** The user whose profile card is currently shown, if any. */
  selectedUser = signal<UserModel | undefined>(undefined);

  /** The curated set of emojis offered by the picker. */
  protected readonly curatedEmojis = CURATED_EMOJIS;

  /** Whether the emoji picker panel is currently open for the message being edited. */
  showEmojiPicker = signal(false);

  /** The thread currently opened via ThreadService, shared with Chat. */
  activeThread = this.threadService.activeThread;

  /** Whether the panel should be shown, i.e. whether a thread is open. */
  isVisible = computed(() => !!this.activeThread());

  /** The parent message as kept live by Firestore. Falls back to the snapshot ThreadService
   *  opened with until the live listener below delivers its first update. */
  private livingParentMessage = signal<Message | null>(null);

  /** The message the open thread belongs to. */
  parentMessage = computed(
    () => this.livingParentMessage() ?? this.activeThread()?.message ?? null,
  );

  /** The identifier of the signed-in user. */
  currentUserId = computed(() => this.authService.currentUserId() ?? '');

  /** Whether the signed-in user belongs to the channel containing the open thread. */
  isChannelMember = computed(() => {
    const channel = this.originChannel();
    const userId = this.currentUserId();
    return !!channel && !!userId && channel.memberIds.includes(userId);
  });

  /** The replies loaded for the currently open thread. */
  replies = signal<ThreadMessage[]>([]);

  /** The reply currently hovered, showing its reaction picker. */
  hoveredReplyId = signal<string | null>(null);

  /** Whether the parent message is currently being edited inline. */
  editingParentMessage = signal(false);

  /** The ID of the thread reply currently being edited inline. */
  editingReplyId = signal<string | null>(null);

  /** The current text used while editing a thread message inline. */
  editText = signal('');

  /** Whether the parent message's reaction picker is currently shown. */
  parentMessageHovered = signal(false);

  /** Unsubscribes from the active thread-replies listener when the open thread changes. */
  private currentThreadUnsubscribe: (() => void) | undefined;

  /** Unsubscribes from the active parent-message listener when the open thread changes. */
  private currentMessageUnsubscribe: (() => void) | undefined;

  /** The scrollable content container of the thread panel. */
  private threadContentElement = viewChild<ElementRef<HTMLDivElement>>('threadContent');

  /** Whether the content should follow new replies by scrolling to the bottom. */
  private shouldAutoScroll = true;

  /** The previously rendered thread, used to detect when a different thread is opened. */
  private previousThread: ActiveThread | null = null;

  /** Subscribes to the live thread data and keeps the scroll position at the bottom. */
  constructor() {
    this.subscribeToActiveThread();
    this.autoScrollOnThreadChange();
  }

  /** Opens or closes the emoji picker panel. */
  toggleEmojiPicker(): void {
    this.showEmojiPicker.update((open) => !open);
  }

  /** Appends the chosen emoji to the edit draft and closes the picker. */
  selectEmoji(emoji: string): void {
    this.editText.set(this.editText() + emoji);
    this.showEmojiPicker.set(false);
  }
  
  /** Re-subscribes to the open thread's parent message and replies whenever it changes. */
  private subscribeToActiveThread(): void {
    effect(() => {
      this.currentThreadUnsubscribe?.();
      this.currentMessageUnsubscribe?.();
      const thread = this.activeThread();
      const messageId = thread?.message.id;
      this.replies.set([]);
      this.livingParentMessage.set(null);
      if (thread?.channelId && messageId) {
        this.subscribeThreadAndMessage(this.channelService, thread.channelId, messageId);
      } else if (thread?.dmId && messageId) {
        this.subscribeThreadAndMessage(this.dmService, thread.dmId, messageId);
      }
    });
  }

  /** Starts the replies and parent-message listeners for one channel or DM conversation. */
  private subscribeThreadAndMessage(
    service: { getThreads: ChannelService['getThreads']; getMessage: ChannelService['getMessage'] },
    conversationId: string,
    messageId: string,
  ): void {
    this.currentThreadUnsubscribe = service.getThreads(conversationId, messageId, (t) =>
      this.replies.set(t),
    ).unsubscribe;
    this.currentMessageUnsubscribe = service.getMessage(conversationId, messageId, (m) =>
      this.livingParentMessage.set(m),
    ).unsubscribe;
  }

  /** Keeps the thread panel scrolled to the bottom as new replies render in. */
  private autoScrollOnThreadChange(): void {
    afterRenderEffect(() => {
      const thread = this.activeThread();
      this.replies();
      const element = this.threadContentElement()?.nativeElement;
      if (!thread || !element) {
        this.previousThread = null;
        return;
      }
      const isNewThread = thread !== this.previousThread;
      this.previousThread = thread;
      if (isNewThread) this.shouldAutoScroll = true;
      if (isNewThread || this.shouldAutoScroll) element.scrollTop = element.scrollHeight;
    });
  }

  /** Removes the active Firestore listeners. */
  ngOnDestroy(): void {
    this.currentThreadUnsubscribe?.();
    this.currentMessageUnsubscribe?.();
  }

  /** Closes the thread panel. */
  close(): void {
    this.threadService.close();
  }

  /** Tracks whether the reader is close enough to the bottom to follow new replies. */
  onThreadContentScroll(event: Event): void {
    const element = event.currentTarget as HTMLDivElement;
    this.shouldAutoScroll = element.scrollHeight - element.scrollTop - element.clientHeight <= 80;
  }

  /** Starts editing the parent message in the active thread. */
  startEditingParentMessage(): void {
    this.showEmojiPicker.set(false);
    const parentMessage = this.parentMessage();
    if (!parentMessage) return;

    this.editingParentMessage.set(true);
    this.editingReplyId.set(null);
    this.editText.set(parentMessage.text);
  }

  /** Starts editing a thread reply message. */
  startEditingReply(reply: ThreadMessage): void {
    this.showEmojiPicker.set(false);
    if (!reply.id) return;

    this.editingParentMessage.set(false);
    this.editingReplyId.set(reply.id);
    this.editText.set(reply.text);
  }

  /** Saves the current inline edit for either the parent message or a reply. */
  async saveEditedMessage(): Promise<void> {
    const thread = this.activeThread();
    const messageId = thread?.message.id;
    const text = this.editText().trim();
    const uid = this.currentUserId();
    if (!thread || !messageId || !uid || !text) return this.resetEditState();

    if (this.editingParentMessage()) {
      await this.saveParentEdit(thread, messageId, text);
    } else {
      const replyId = this.editingReplyId();
      if (!replyId) return this.resetEditState();
      await this.saveReplyEdit(thread, messageId, replyId, text);
    }
    this.editText.set('');
  }

  /** Clears the inline-edit state without persisting anything. */
  private resetEditState(): void {
    this.editingParentMessage.set(false);
    this.editingReplyId.set(null);
    this.editText.set('');
  }

  /**
   * Persists an edit to the thread's parent message in its channel or direct message.
   *
   * @param thread The active thread containing the parent message.
   * @param messageId The ID of the parent message to update.
   * @param text The updated message text.
   */
  private async saveParentEdit(thread: ActiveThread, messageId: string, text: string): Promise<void> {
    if (thread.channelId) {
      await this.channelService.editChannelMessage(thread.channelId, messageId, text);
    } else if (thread.dmId) {
      await this.dmService.editDmMessage(thread.dmId, messageId, text);
    }
    this.editingParentMessage.set(false);
  }

  /**
   * Persists an edit to a reply in the active thread's channel or direct message.
   *
   * @param thread The active thread containing the reply.
   * @param messageId The ID of the parent message.
   * @param replyId The ID of the reply to update.
   * @param text The updated reply text.
   */
  private async saveReplyEdit(
    thread: ActiveThread,
    messageId: string,
    replyId: string,
    text: string,
  ): Promise<void> {
    if (thread.channelId) {
      await this.channelService.editThreadMessage(thread.channelId, messageId, replyId, text);
    } else if (thread.dmId) {
      await this.dmService.editThreadMessage(thread.dmId, messageId, replyId, text);
    }
    this.editingReplyId.set(null);
  }

  /** Sends a reply to the currently open thread. */
  async sendReply(text: string): Promise<void> {
    const thread = this.activeThread();
    const uid = this.currentUserId();
    const messageId = thread?.message.id;

    if (!thread || !messageId || !uid) return;

    if (thread.channelId) {
      await this.channelService.addChannelThread(thread.channelId, messageId, text, uid);
    } else if (thread.dmId) {
      await this.dmService.addDmThread(thread.dmId, messageId, text, uid);
    }
  }

  /** Toggles a reaction on a thread reply. */
  async onReactionToggled(reply: ThreadMessage, emoji: string): Promise<void> {
    const thread = this.activeThread();
    const uid = this.currentUserId();
    const messageId = thread?.message.id;
    const replyId = reply.id;
    if (!thread || !messageId || !replyId || !uid) return;
    const alreadyReacted = reply.reactions?.[emoji]?.includes(uid) ?? false;
    await toggleReaction(thread.channelId, thread.dmId, alreadyReacted, {
      channelAdd: (channelId) => this.channelService.addReactionToThreadMessage(channelId, messageId, emoji, uid, replyId),
      channelRemove: (channelId) => this.channelService.removeReactionFromThreadMessage(channelId, messageId, emoji, uid, replyId),
      dmAdd: (dmId) => this.dmService.addReactionToDmThreadMessage(dmId, messageId, emoji, uid, replyId),
      dmRemove: (dmId) => this.dmService.removeReactionFromDmThreadMessage(dmId, messageId, emoji, uid, replyId),
    });
  }

  /** Toggles a reaction on the thread's parent message. */
  async onParentReactionToggled(emoji: string): Promise<void> {
    const thread = this.activeThread();
    const uid = this.currentUserId();
    const messageId = thread?.message.id;
    const parentMessage = this.parentMessage();
    if (!thread || !messageId || !uid || !parentMessage) return;
    const alreadyReacted = parentMessage.reactions?.[emoji]?.includes(uid) ?? false;
    await toggleReaction(thread.channelId, thread.dmId, alreadyReacted, {
      channelAdd: (channelId) => this.channelService.addReactionToChannelMessage(channelId, messageId, emoji, uid),
      channelRemove: (channelId) => this.channelService.removeReactionFromChannelMessage(channelId, messageId, emoji, uid),
      dmAdd: (dmId) => this.dmService.addReactionToDmMessage(dmId, messageId, emoji, uid),
      dmRemove: (dmId) => this.dmService.removeReactionFromDmMessage(dmId, messageId, emoji, uid),
    });
  }

  /** Converts a Firestore reaction map for the reaction bar. */
  messageReactions(message: ThreadMessage | Message): MessageReaction[] {
    const uid = this.currentUserId();
    return Object.entries(message.reactions ?? {}).map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
      reactedByCurrentUser: userIds.includes(uid),
    }));
  }

  /** Resolves a sender's display name from their user ID. */
  getSenderName(senderId: string): string {
    return this.userService.users().find((user) => user.uid === senderId)?.name ?? senderId;
  }

  /** Resolves a sender's avatar from their user ID. */
  getSenderAvatar(senderId: string): string {
    return this.userService.users().find((user) => user.uid === senderId)?.avatar ?? senderId;
  }

  /** Resolves a sender's user profile from their ID. */
  getSenderUser(senderId: string): UserModel | undefined {
    return this.userService.users().find((user) => user.uid === senderId);
  }

  /** Opens the direct-message conversation with the selected thread author. */
  async openDmWithUser(user: UserModel): Promise<void> {
    await this.dmService.openDmWith(user.uid);
    this.close();
  }

  /** The channel the open thread belongs to, if it was opened from a channel. */
  originChannel = computed(() =>
    this.channelService.channels().find((channel) => channel.id === this.activeThread()?.channelId),
  );

  /** The DM partner the open thread belongs to, if it was opened from a direct message. */
  originDmPartner = computed(() => {
    const dmId = this.activeThread()?.dmId;
    if (!dmId) return undefined;

    const dm = this.dmService.dms().find((dm) => dm.id === dmId);
    const partnerId = dm?.memberIds.find(
      (memberId) => memberId !== this.authService.currentUserId(),
    );
    return this.userService.users().find((user) => user.uid === partnerId);
  });
}
