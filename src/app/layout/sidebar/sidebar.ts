import { Component, EventEmitter, Input, Output, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Channel } from '../../shared/interfaces/channel';
import { UserModel } from '../../shared/model/user.model';
import { ChannelService } from '../../shared/services/channel-service';
import { DmService } from '../../shared/services/dm-service';
import { AuthService } from '../../shared/services/auth';
import { CreateChannel } from './create-channel/create-channel';
import { Dm } from '../../shared/interfaces/dm';

@Component({
  imports: [CommonModule, CreateChannel],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
/** Displays channels and direct-message contacts in the application sidebar. */
export class Sidebar {
  /** Provides the available channels and channel selection state. */
  channelService = inject(ChannelService);

  /** Provides direct-message data and selection state. */
  dmService = inject(DmService);

  /** Provides reactive authentication state. */
  private authService = inject(AuthService);

  /** Reference to the create-channel dialog. */
  @ViewChild('createChannel') private createChannel!: CreateChannel;

  /** Identifier of the active channel. */
  @Input() activeChannelId: string | null = null;

  /** Emitted when a channel is selected. */
  @Output() channelSelected = new EventEmitter<Channel>();
  /** Emitted when channel creation is requested. */
  @Output() channelCreateRequested = new EventEmitter<void>();
  /** Emitted when workspace editing is requested. */
  @Output() workspaceEditRequested = new EventEmitter<void>();
  /** Emitted whenever the sidebar's visibility changes, so the parent (e.g. Dashboard) can adjust its layout. */
  @Output() sidebarToggled = new EventEmitter<boolean>();

  /** Whether the channels section is expanded. */
  isChannelsOpen = true;

  /** Whether the direct-messages section is expanded. */
  isDirectMessagesOpen = true;

  /** localStorage key used to persist the sidebar's open/closed state across reloads. */
  private readonly SIDEBAR_STATE_KEY = 'sidebarOpen';

  /** Whether the sidebar is currently visible. */
  isSidebarOpen = signal<boolean>(true);

  /**
   * Restores the persisted sidebar visibility state on initialization and
   * notifies the parent component of the initial state.
   */
  ngOnInit(): void {
    const stored = localStorage.getItem(this.SIDEBAR_STATE_KEY);
    const initialState = stored !== null ? stored === 'true' : true;
    this.isSidebarOpen.set(initialState);
    this.sidebarToggled.emit(initialState);
  }

  /**
   * Toggles the sidebar's visibility, persists the new state to localStorage,
   * and notifies the parent component via {@link sidebarToggled}.
   */
  toggleSidebar(): void {
    const newState = !this.isSidebarOpen();
    this.isSidebarOpen.set(newState);
    localStorage.setItem(this.SIDEBAR_STATE_KEY, String(newState));
    this.sidebarToggled.emit(newState);
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
    this.channelService.selectChannel(channel.id);
    this.dmService.activeDmId.set(undefined);
    this.channelSelected.emit(channel);
  }

  /** Selects a direct-message conversation, creating it on first contact. */
  async selectDirectMessage(partner: {
    user: UserModel;
    isSelf: boolean;
    dm: Dm | null;
  }): Promise<void> {
    const currentUserId = this.authService.currentUserId();
    if (!currentUserId) return;

    this.channelService.activeChannelId.set(undefined);
    if (partner.dm) {
      this.dmService.selectDm(partner.dm.id);
    } else {
      await this.dmService.addDm([currentUserId, partner.user.uid]);
    }
  }

  /** Requests creation of a channel. */
  openChannelCreate(event?: Event): void {
    event?.stopPropagation();
    this.createChannel.open();
    this.channelCreateRequested.emit();
  }

  /** Requests editing of the workspace. */
  openWorkspaceEdit(): void {
    this.workspaceEditRequested.emit();
  }
}
