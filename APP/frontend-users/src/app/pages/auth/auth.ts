// src/app/pages/auth/auth.ts
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './auth.html',
  styleUrls: ['./auth.css'],
})
export class AuthComponent implements OnInit {
  isRegisterMode = false;
  isSubmitting = false;

  // Login
  loginEmail = '';
  loginPassword = '';

  // Register
  firstName = '';
  lastName = '';
  registerEmail = '';
  dni = '';
  school = '';
  degree = '';
  phone = '';
  type = 'user';
  registerPassword = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const currentPath = this.route.snapshot.routeConfig?.path;
    this.isRegisterMode = currentPath === 'register';
  }

  setRegisterMode() {
    if (this.isSubmitting) return;
    this.isRegisterMode = true;
  }

  setLoginMode() {
    if (this.isSubmitting) return;
    this.isRegisterMode = false;
  }

  login() {
    if (this.isSubmitting) return;

    this.isSubmitting = true;

    this.auth
      .login(this.loginEmail, this.loginPassword)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => this.router.navigate(['/user-area']),
        error: () => alert('Login incorrecto'),
      });
  }

  register() {
    if (this.isSubmitting) return;

    this.isSubmitting = true;

    const user = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.registerEmail,
      dni: this.dni,
      school: this.school,
      degree: this.degree,
      phone: this.phone,
      type: this.type,
      password: this.registerPassword,
    };

    this.auth
      .register(user)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          window.location.href = '/login';
        },
        error: (err) => {
          console.error('Register error:', err);

          const message =
            err?.error?.message ||
            err?.error ||
            err?.message ||
            'Error en el registro';

          alert(message);
        },
      });
  }
}