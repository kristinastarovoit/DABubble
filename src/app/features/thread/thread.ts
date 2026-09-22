import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageInput } from '../chat/message-input/message-input';
import { ReactionBar } from '../chat/reaction-bar/reaction-bar';
import { ReactionPicker } from '../chat/reaction-picker/reaction-picker';
import { Message, MessageReaction } from '../../shared/interfaces/message';
import { ThreadMessage } from '../../shared/interfaces/thread';
import { ThreadService } from '../../shared/services/thread-service';
import { ChannelService } from '../../shared/services/channel-service';
import { DmService } from '../../shared/services/dm-service';
import { AuthService } from '../../shared/services/auth';
import { UserService } from '../../shared/services/users';

@Component({
  imports: [CommonModule, MessageInput, ReactionBar, ReactionPicker],
  selector: 'app-thread',
  styleUrl: './thread.scss',
  templateUrl: './thread.html',
})
export class Thread {
  private threadService = inject(ThreadService);
  private channelService = inject(ChannelService);
  private dmService = inject(DmService);
  private authService = inject(AuthService);
  private userService = inject(UserService);

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

  /** The replies loaded for the currently open thread. */
  replies = signal<ThreadMessage[]>([]);

  /** The reply currently hovered, showing its reaction picker. */
  hoveredReplyId = signal<string | null>(null);

  /** Whether the parent message's reaction picker is currently shown. */
  parentMessageHovered = signal(false);

  /** Unsubscribes from the active thread-replies listener when the open thread changes. */
  private currentThreadUnsubscribe: (() => void) | undefined;

  /** Unsubscribes from the active parent-message listener when the open thread changes. */
  private currentMessageUnsubscribe: (() => void) | undefined;

  constructor() {
    effect(() => {
      this.currentThreadUnsubscribe?.();
      this.currentThreadUnsubscribe = undefined;
      this.currentMessageUnsubscribe?.();
      this.currentMessageUnsubscribe = undefined;

      const thread = this.activeThread();
      const messageId = thread?.message.id;

      if (thread?.channelId && messageId) {
        const { unsubscribe: unsubscribeThread } = this.channelService.getThreads(
          thread.channelId,
          messageId,
          (threadMessages) => this.replies.set(threadMessages),
        );
        this.currentThreadUnsubscribe = unsubscribeThread;

        const { unsubscribe: unsubscribeMessage } = this.channelService.getMessage(
          thread.channelId,
          messageId,
          (message) => this.livingParentMessage.set(message),
        );
        this.currentMessageUnsubscribe = unsubscribeMessage;
      } else if (thread?.dmId && messageId) {
        const { unsubscribe: unsubscribeThread } = this.dmService.getThreads(
          thread.dmId,
          messageId,
          (threadMessages) => this.replies.set(threadMessages),
        );
        this.currentThreadUnsubscribe = unsubscribeThread;

        const { unsubscribe: unsubscribeMessage } = this.dmService.getMessage(
          thread.dmId,
          messageId,
          (message) => this.livingParentMessage.set(message),
        );
        this.currentMessageUnsubscribe = unsubscribeMessage;
      } else {
        this.replies.set([]);
        this.livingParentMessage.set(null);
      }
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

    if (thread.channelId) {
      if (alreadyReacted) {
        await this.channelService.removeReactionFromThreadMessage(
          thread.channelId,
          messageId,
          emoji,
          uid,
          replyId,
        );
      } else {
        await this.channelService.addReactionToThreadMessage(
          thread.channelId,
          messageId,
          emoji,
          uid,
          replyId,
        );
      }
    } else if (thread.dmId) {
      if (alreadyReacted) {
        await this.dmService.removeReactionFromDmThreadMessage(
          thread.dmId,
          messageId,
          emoji,
          uid,
          replyId,
        );
      } else {
        await this.dmService.addReactionToDmThreadMessage(
          thread.dmId,
          messageId,
          emoji,
          uid,
          replyId,
        );
      }
    }
  }

  /** Toggles a reaction on the thread's parent message. */
  async onParentReactionToggled(emoji: string): Promise<void> {
    const thread = this.activeThread();
    const uid = this.currentUserId();
    const messageId = thread?.message.id;
    const parentMessage = this.parentMessage();

    if (!thread || !messageId || !uid || !parentMessage) return;

    const alreadyReacted = parentMessage.reactions?.[emoji]?.includes(uid) ?? false;

    if (thread.channelId) {
      if (alreadyReacted) {
        await this.channelService.removeReactionFromChannelMessage(
          thread.channelId,
          messageId,
          emoji,
          uid,
        );
      } else {
        await this.channelService.addReactionToChannelMessage(
          thread.channelId,
          messageId,
          emoji,
          uid,
        );
      }
    } else if (thread.dmId) {
      if (alreadyReacted) {
        await this.dmService.removeReactionFromDmMessage(thread.dmId, messageId, emoji, uid);
      } else {
        await this.dmService.addReactionToDmMessage(thread.dmId, messageId, emoji, uid);
      }
    }
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
}
