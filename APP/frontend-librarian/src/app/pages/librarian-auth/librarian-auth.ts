import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { LibrarianAuthService, LibrarianSession } from '../../services/librarian-auth';

@Component({
  selector: 'app-librarian-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './librarian-auth.html',
  styleUrls: ['./librarian-auth.css']
})
export class LibrarianAuthComponent {
  email = '';
  password = '';
  isSubmitting = false;
  errorMessage = '';

  constructor(
    private auth: LibrarianAuthService,
    private router: Router
  ) {}

  login() {
    if (this.isSubmitting) return;

    this.errorMessage = '';
    this.isSubmitting = true;

    this.auth
      .login(this.email, this.password)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (session: LibrarianSession) => {
          const userType = (session.user.type || '').toLowerCase();

          if (userType !== 'librarian') {
            this.auth.logout();
            this.errorMessage = 'This panel is only available for librarian accounts.';
            return;
          }

          this.router.navigate(['/monitor']);
        },
        error: (err: any) => {
          this.errorMessage =
            err?.error?.message ||
            err?.message ||
            'Invalid credentials.';
        }
      });
  }
}