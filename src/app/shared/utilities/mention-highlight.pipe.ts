import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { UserService } from '../services/users';
import { ChannelService } from '../services/channel-service';

/** Escapes HTML-sensitive characters so raw message text can be safely inserted as HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

@Pipe({
  name: 'mentionHighlight',
  standalone: true,
})
/** Renders message text with `@user` and `#channel` mentions shown in bold. */
export class MentionHighlightPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);
  private userService = inject(UserService);
  private channelService = inject(ChannelService);

  transform(text: string): SafeHtml {
    const escaped = escapeHtml(text ?? '');
    const names = [
      ...this.userService.users().map((user) => user.name),
      ...this.channelService.channels().map((channel) => channel.name),
    ]
      // Longest names first so e.g. "Max Mustermann" wins over "Max".
      .sort((a, b) => b.length - a.length)
      .map((name) => escapeHtml(name));

    if (names.length === 0) return this.sanitizer.bypassSecurityTrustHtml(escaped);

    const pattern = new RegExp(`([@#])(${names.map((name) => escapeRegExp(name)).join('|')})`, 'g');
    const highlighted = escaped.replace(pattern, '<strong>$1$2</strong>');

    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }
}

/** Escapes regex-sensitive characters in a string used as a literal pattern. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
