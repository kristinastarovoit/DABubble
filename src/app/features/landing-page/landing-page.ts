import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Intro } from './intro/intro';

/** Module state; resets on a full page load, so in-app navigation does not replay the intro. */
let introPlayed = false;

const LANDING_ROUTES = ['/', '/login'];

/**
 * Decides whether the intro should play now and marks it as played.
 * @param url Current router URL; only landing routes qualify (not embedded instances, e.g. in the chat).
 * @returns `true` on the first qualifying call per page load unless reduced motion is preferred.
 */
function shouldPlayIntro(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  if (introPlayed || !LANDING_ROUTES.includes(path)) return false;
  introPlayed = true;
  return !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

@Component({
  selector: 'app-landing-page',
  imports: [RouterOutlet, RouterLink, Intro],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.scss',
})
export class LandingPage {
  private router = inject(Router);

  /** Whether the intro overlay is shown; also hides the real header logo while active. */
  protected showIntro = signal(shouldPlayIntro(this.router.url));

  protected isLoginPage = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url === '/login'),
      startWith(this.router.url === '/login'),
    ),
    { initialValue: this.router.url === '/login' },
  );
}
