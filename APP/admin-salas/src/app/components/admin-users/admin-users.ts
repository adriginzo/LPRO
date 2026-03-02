import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { UsersService, UserAdmin } from '../../services/users';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './admin-users.html',
  styleUrls: ['./admin-users.css']
})
export class AdminUsersComponent {
  users = signal<UserAdmin[]>([]);
  searchUser = signal<string>(''); // ✅ buscador

  filteredUsers = computed(() => {
    const term = this.searchUser().trim().toLowerCase();
    const all = this.users();
    if (!term) return all;

    return all.filter(u => {
      const haystack = [
        u.firstName, u.lastName, u.email, u.dni, u.school, u.degree, u.phone, u.type
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  });

  newUser: UserAdmin = {
    firstName: '',
    lastName: '',
    email: '',
    dni: '',
    school: '',
    degree: '',
    phone: '',
    type: 'user',
    password: ''
  };

  constructor(private usersService: UsersService) {
    this.loadUsers();
  }

  loadUsers() {
    this.usersService.getUsers().subscribe((data) => this.users.set(data));
  }

  createUser() {
    const payload: UserAdmin = {
      ...this.newUser,
      firstName: this.newUser.firstName.trim(),
      lastName: this.newUser.lastName.trim(),
      email: this.newUser.email.trim().toLowerCase(),
      dni: this.newUser.dni.trim().toUpperCase(),
      school: (this.newUser.school || '').trim(),
      degree: (this.newUser.degree || '').trim(),
      phone: (this.newUser.phone || '').trim(),
      type: this.newUser.type,
      password: this.newUser.password || ''
    };

    this.usersService.createUser(payload).subscribe(() => {
      this.newUser = {
        firstName: '',
        lastName: '',
        email: '',
        dni: '',
        school: '',
        degree: '',
        phone: '',
        type: 'user',
        password: ''
      };
      this.loadUsers();
    });
  }

  saveUser(u: UserAdmin) {
    if (!u._id) return;

    const payload: Partial<UserAdmin> = {
      firstName: (u.firstName || '').trim(),
      lastName: (u.lastName || '').trim(),
      email: (u.email || '').trim().toLowerCase(),
      dni: (u.dni || '').trim().toUpperCase(),
      school: (u.school || '').trim(),
      degree: (u.degree || '').trim(),
      phone: (u.phone || '').trim(),
      type: u.type
    };

    if (u.password && String(u.password).trim().length > 0) {
      payload.password = String(u.password);
    }

    this.usersService.updateUser(u._id, payload).subscribe(() => this.loadUsers());
  }

  deleteUser(id: string) {
    this.usersService.deleteUser(id).subscribe(() => this.loadUsers());
  }
}