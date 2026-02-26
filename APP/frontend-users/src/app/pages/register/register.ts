// src/app/pages/register/register.ts
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './register.html',
})
export class RegisterComponent {
  firstName = '';
  lastName = '';
  email = '';
  dni = '';
  school = '';
  degree = '';
  phone = '';
  type = 'user';
  password = '';

  constructor(private auth: AuthService, private router: Router) {}

  register() {
    const user = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      dni: this.dni,
      school: this.school,
      degree: this.degree,
      phone: this.phone,
      type: this.type,
      password: this.password,
    };

    this.auth.register(user).subscribe({
      next: () => this.router.navigate(['/login']),
      error: (err) => alert(err.error.message || 'Error en el registro'),
    });
  }
}