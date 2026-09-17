import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Channel } from '../../shared/interfaces/channel';
import { User } from '../../shared/interfaces/user';
import { FIREBASE_AUTH } from '../../app.config';
import { ChannelService } from '../../shared/services/channel-service';
import { DmService } from '../../shared/services/dm-service';
import { UserService } from '../../shared/services/users';

/** Represents a direct-message contact together with its conversation ID. */
interface SidebarDirectMessage extends User {
  dmId: string;
}

/** Displays backend-backed channels and direct-message conversations. */
@Component({
  imports: [CommonModule],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
export class Sidebar implements OnInit, OnDestroy {
  /** Available workspace channels. */
  @Input() channels: Channel[] = [];
  /** Available direct-message contacts. */
  @Input() directMessages: User[] = [];
  /** Identifier of the active channel. */
  @Input() activeChannelId: string | null = null;
  /** Identifier of the active direct message. */
  @Input() activeDmId: string | null = null;

  /** Emitted when a channel is selected. */
  @Output() channelSelected = new EventEmitter<Channel>();
  /** Emitted when a direct-message contact is selected. */
  @Output() directMessageSelected = new EventEmitter<User>();
  /** Emitted when channel creation is requested. */
  @Output() channelCreateRequested = new EventEmitter<void>();
  /** Emitted when workspace editing is requested. */
  @Output() workspaceEditRequested = new EventEmitter<void>();

  isChannelsOpen = true;
  isDirectMessagesOpen = true;

  private readonly channelService = inject(ChannelService, { optional: true });
  private readonly dmService = inject(DmService, { optional: true });
  private readonly userService = inject(UserService, { optional: true });
  private readonly auth = inject(FIREBASE_AUTH, { optional: true });
  private users?: ReturnType<UserService['getUsers']>['users'];
  private unsubscribeUsers?: () => void;

  /** Starts the user-profile listener used to resolve DM contacts. */
  ngOnInit(): void {
    if (this.userService) {
      const userSubscription = this.userService.getUsers();
      this.users = userSubscription.users;
      this.unsubscribeUsers?.();
      this.unsubscribeUsers = userSubscription.unsubscribe;
    }
  }

  /** Removes the user-profile listener when the sidebar is destroyed. */
  ngOnDestroy(): void {
    this.unsubscribeUsers?.();
  }

  /** Returns backend channels when the service is available. */
  get displayedChannels(): Channel[] {
    return this.channelService?.channels() ?? this.channels;
  }

  /** Maps backend DM conversations to the contact shape used by the template. */
  get displayedDirectMessages(): SidebarDirectMessage[] {
    const directMessages = this.dmService?.dms() ?? [];
    if (!this.dmService) {
      return this.directMessages.map((contact) => ({ ...contact, dmId: contact.id }));
    }

    const currentUserId = this.auth?.currentUser?.uid;
    return directMessages.map((directMessage) => {
      const contactId = directMessage.memberIds.find((memberId) => memberId !== currentUserId)
        ?? directMessage.memberIds[0]
        ?? '';
      const contact = this.users?.().find((user) => user.uid === contactId);

      return {
        id: directMessage.id,
        dmId: directMessage.id,
        name: contact?.name ?? 'Unknown user',
        email: contact?.email ?? '',
        avatarUrl: contact?.avatar ?? '',
        isOnline: contact?.status === 'online',
        createdAt: new Date(),
      };
    });
  }

  /** Toggles the channel section. */
  toggleChannels(): void {
    this.isChannelsOpen = !this.isChannelsOpen;
  }

  /** Toggles the direct-message section. */
  toggleDirectMessages(): void {
    this.isDirectMessagesOpen = !this.isDirectMessagesOpen;
  }

  /** Selects a channel. */
  selectChannel(channel: Channel): void {
    this.channelSelected.emit(channel);
  }

  /** Selects a direct-message contact. */
  selectDirectMessage(contact: User): void {
    this.directMessageSelected.emit(contact);
  }

  /** Requests creation of a channel. */
  openChannelCreate(): void {
    this.channelCreateRequested.emit();
  }

  /** Requests editing of the workspace. */
  openWorkspaceEdit(): void {
    this.workspaceEditRequested.emit();
  }
}
