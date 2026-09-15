import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Channel } from '../../../shared/interfaces/channel';

@Component({
  imports: [CommonModule],
  selector: 'app-channel-header',
  styleUrl: './channel-header.scss',
  templateUrl: './channel-header.html',
})
export class ChannelHeader {
  /** The channel represented by the header. */
  @Input() channel: Channel | null = null;
  /** Emitted when the member icon is clicked. */
  @Output() memberIconClicked = new EventEmitter<void>();
  /** Emitted when channel details are requested. */
  @Output() channelDetailsRequested = new EventEmitter<void>();

  /** Requests the channel details view. */
  openChannelDetails(): void {
    this.channelDetailsRequested.emit();
  }
}
