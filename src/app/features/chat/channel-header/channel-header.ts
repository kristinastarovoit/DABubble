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
  @Input() channel: Channel | null = null;
  @Output() memberIconClicked = new EventEmitter<void>();
  @Output() channelDetailsRequested = new EventEmitter<void>();

  openChannelDetails(): void {
    this.channelDetailsRequested.emit();
  }
}
