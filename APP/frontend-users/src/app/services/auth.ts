// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

type JwtPayload = {
  email?: string;
  sub?: string;
  type?: string;
  exp?: number; // seconds since epoch
  iat?: number;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = 'http://100.80.240.31:3001';

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<any> {
    return this.http
      .post(`${this.baseUrl}/users/login`, { email, password })
      .pipe(tap((res: any) => localStorage.setItem('token', res.access_token)));
  }

  register(user: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/users`, user);
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUser(): JwtPayload | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      return jwtDecode<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = jwtDecode<JwtPayload>(token);
      if (!payload?.exp) return false; // si no hay exp, no lo consideramos expirado
      const nowSeconds = Math.floor(Date.now() / 1000);
      return payload.exp <= nowSeconds;
    } catch {
      return true; // si no se puede decodificar, lo tratamos como inválido
    }
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    return !this.isTokenExpired(token);
  }

  isAdmin(): boolean {
    const user = this.getUser();
    return user?.type === 'admin';
  }
}