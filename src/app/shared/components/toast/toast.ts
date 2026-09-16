import {
  Component,
  inject,
  input,
  viewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';

@Component({
  imports: [],
  selector: 'app-toast',
  styleUrl: './toast.scss',
  templateUrl: './toast.html',
})
export class Toast implements AfterViewInit, OnDestroy {
  private router = inject(Router);

  message = input.required<string>();

  private dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('toastDialog');
  private timeoutId?: ReturnType<typeof setTimeout>;

  ngAfterViewInit() {
    this.dialogRef().nativeElement.showModal();

    this.timeoutId = setTimeout(() => {
      this.router.navigate(['/login']);
    }, 3000);
  }

  ngOnDestroy() {
    clearTimeout(this.timeoutId);
  }
}
