import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

/** Duration of the logo symbol sliding in from the right. */
const ENTER_MS = 800;
/** Duration of the wordmark wipe from left to right. */
const WIPE_MS = 500;
/** Pause after the wordmark is fully visible. */
const HOLD_MS = 1000;
/** Duration of the flight to the header logo. */
const FLY_MS = 800;
/** Shared easing for the larger movements. */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** Width of the logo SVG viewBox. */
const LOGO_WIDTH = 243;
/** Height of the logo SVG viewBox. */
const LOGO_HEIGHT = 70;

/**
 * Fullscreen intro overlay: the logo slides in, the wordmark is wiped in,
 * and after a short pause both fly to the header logo position.
 */
@Component({
  selector: 'app-intro',
  templateUrl: './intro.html',
  styleUrl: './intro.scss',
  host: { 'aria-hidden': 'true', '(click)': 'finish()', '(document:keydown)': 'finish()' },
})
export class Intro {
  /** Header logo element whose position and size the intro logo flies to. */
  readonly target = input.required<HTMLElement>();
  /** Emits once when the intro ends, by completion or skip. */
  readonly finished = output<void>();

  private logo = viewChild.required<ElementRef<HTMLElement>>('logo');
  private backdrop = viewChild.required<ElementRef<HTMLElement>>('backdrop');
  private mark = viewChild.required<ElementRef<SVGGElement>>('mark');
  private word = viewChild.required<ElementRef<SVGGElement>>('word');
  private stopped = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.stopped = true));
    afterNextRender(() => this.play());
  }

  /** Ends the intro (idempotent) and notifies the parent. Also stops any running sequence. */
  protected finish() {
    if (this.stopped) return;
    this.stopped = true;
    this.finished.emit();
  }

  /**
   * Runs a Web Animation that keeps its end state.
   * @param el Element to animate.
   * @param keyframes Keyframes of the animation.
   * @param options Timing options.
   * @returns Promise resolving when the animation has finished.
   */
  private animate(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    return el.animate(keyframes, { fill: 'both', ...options }).finished;
  }

  /**
   * Plays the full sequence: enter, wordmark wipe, hold, fly to header.
   * Skips immediately where the Web Animations API is unavailable (e.g. jsdom).
   */
  private async play() {
    const logo = this.logo().nativeElement;
    if (typeof logo.animate !== 'function') return this.finish();

    const size = this.target().getBoundingClientRect();
    const scale = Math.min(innerWidth * 0.8, 520) / size.width;
    const left = (innerWidth - size.width * scale) / 2;
    const centered = `translate(${left}px, ${(innerHeight - size.height * scale) / 2}px) scale(${scale})`;
    Object.assign(logo.style, {
      width: `${size.width}px`,
      height: `${size.height}px`,
      transform: centered,
    });

    const unit = Math.min(size.width / LOGO_WIDTH, size.height / LOGO_HEIGHT) * scale;
    const fromRight = (innerWidth - left) / unit;
    await this.animate(
      this.mark().nativeElement,
      [
        { opacity: 1, transform: `translateX(${fromRight}px)` },
        { opacity: 1, transform: 'translateX(0)' },
      ],
      { duration: ENTER_MS, easing: EASE },
    );
    if (this.stopped) return;

    const word = this.word().nativeElement;
    await this.animate(
      word,
      [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
      { duration: WIPE_MS, easing: 'ease-out' },
    );
    if (this.stopped) return;

    await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
    if (this.stopped) return;

    const to = this.target().getBoundingClientRect();
    const options = { duration: FLY_MS, easing: EASE };
    await Promise.all([
      this.animate(
        logo,
        [{ transform: centered }, { transform: `translate(${to.left}px, ${to.top}px) scale(1)` }],
        options,
      ),
      this.animate(word, [{ fill: '#ffffff' }, { fill: '#000000' }], options),
      this.animate(this.backdrop().nativeElement, [{ opacity: 1 }, { opacity: 0 }], options),
    ]);
    this.finish();
  }
}
