import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-user-area',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-area.html',
  styleUrls: ['./user-area.css']
})
export class UserAreaComponent {
  users$: Observable<any[]>; // Observable de usuarios
  isAdmin = false;

  constructor(
    private auth: AuthService,
    private http: HttpClient
  ) {
    this.isAdmin = this.auth.isAdmin();
    this.users$ = this.http.get<any[]>('http://localhost:3001/users');
  }

  goToAdminPanel() {
    window.location.href = 'http://100.80.240.31:4200/admin-salas';
  }
}