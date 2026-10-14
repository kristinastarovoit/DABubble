import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Intro } from './intro/intro';

// Module state resets on a full page load, so in-app navigation does not replay the intro.
let introPlayed = false;

function shouldPlayIntro(): boolean {
  if (introPlayed) return false;
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

  protected showIntro = signal(shouldPlayIntro());

  protected isLoginPage = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url === '/login'),
      startWith(this.router.url === '/login'),
    ),
    { initialValue: this.router.url === '/login' },
  );
}
