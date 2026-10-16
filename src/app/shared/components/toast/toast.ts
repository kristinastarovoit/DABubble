import { Component, inject, input, viewChild, ElementRef, AfterViewInit, OnDestroy} from '@angular/core';
import { Router } from '@angular/router';

/** Displays a toast dialog and redirects to login after a short delay. */
@Component({
  imports: [],
  selector: 'app-toast',
  styleUrl: './toast.scss',
  templateUrl: './toast.html',
})
export class Toast implements AfterViewInit, OnDestroy {
  /** Navigates to the login page when the toast timeout expires. */
  private router = inject(Router);

  /** Message displayed in the toast dialog. */
  message = input.required<string>();

  /** Reference to the toast dialog element. */
  private dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('toastDialog');

  /** Timer that schedules navigation to the login page. */
  private timeoutId?: ReturnType<typeof setTimeout>;

  /** Opens the toast dialog and schedules navigation to the login page. */
  ngAfterViewInit() {
    this.dialogRef().nativeElement.showModal();

    this.timeoutId = setTimeout(() => {
      this.router.navigate(['/login']);
    }, 3000);
  }

  /** Clears the pending redirect timer when the toast is destroyed. */
  ngOnDestroy() {
    clearTimeout(this.timeoutId);
  }
}
