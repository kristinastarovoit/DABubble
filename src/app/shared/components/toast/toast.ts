import { Component, inject, input, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  imports: [],
  selector: 'app-toast',
  styleUrl: './toast.scss',
  templateUrl: './toast.html',
})
export class Toast implements OnInit {
  private router = inject(Router);

  message = input.required<string>();
  private timeoutId?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 3000);
  }

  ngOnDestroy() {
    clearTimeout(this.timeoutId);
  }
}
