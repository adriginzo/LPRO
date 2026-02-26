import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { RegisterService, UserRegisterDTO } from '../../services/register';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.html'
})
export class RegisterComponent {
  // Definir todas las propiedades para ngModel
  firstName = '';
  lastName = '';
  email = '';
  dni = '';
  school = '';
  degree = '';
  phone = '';
  type = 'user';
  password = '';
  errorMessage = '';

  constructor(private registerService: RegisterService, private router: Router) {}

  register() {
    console.log('Register button clicked');
    this.errorMessage = '';

    // Validaciones básicas
    if (!this.firstName || !this.lastName || !this.email || !this.dni || !this.password) {
      this.errorMessage = 'Please fill in all required fields.';
      return;
    }

    const user: UserRegisterDTO = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      dni: this.dni,
      school: this.school,
      degree: this.degree,
      phone: this.phone,
      type: this.type,
      password: this.password
    };

    this.registerService.registerUser(user).subscribe({
      next: () => {
        alert('User registered successfully!');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Error registering user';
      }
    });
  }
}