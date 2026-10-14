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

const ENTER_MS = 1000;
const LETTER_MS = 350;
const LETTER_STEP_MS = 120;
const HOLD_MS = 2000;
const FLY_MS = 1000;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const LOGO_WIDTH = 243;
const LOGO_HEIGHT = 70;

@Component({
  selector: 'app-intro',
  templateUrl: './intro.html',
  styleUrl: './intro.scss',
  host: { 'aria-hidden': 'true', '(click)': 'finish()', '(document:keydown)': 'finish()' },
})
export class Intro {
  readonly target = input.required<HTMLElement>();
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

  protected finish() {
    if (this.stopped) return;
    this.stopped = true;
    this.finished.emit();
  }

  private animate(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    return el.animate(keyframes, { fill: 'both', ...options }).finished;
  }

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
    await Promise.all(
      Array.from(word.children).map((letter, i) =>
        this.animate(
          letter,
          [
            { opacity: 0, transform: 'translateX(-12px)' },
            { opacity: 1, transform: 'translateX(0)' },
          ],
          { duration: LETTER_MS, delay: i * LETTER_STEP_MS, easing: 'ease-out' },
        ),
      ),
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
