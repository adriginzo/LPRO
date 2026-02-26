import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { AbilityService } from './ability';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'token';

  constructor(
    private router: Router,
    private abilityService: AbilityService
  ) {}

  login(email: string, password: string) {
    // FAKE LOGIN (replace with backend call)
    const fakeToken = JSON.stringify({
      email,
      type: email === 'admin@test.com' ? 'admin' : 'user'
    });

    localStorage.setItem(this.tokenKey, fakeToken);
    this.setAbilities();
    this.router.navigate(['/user-area']);
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  getUserType(): string | null {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) return null;
    return JSON.parse(token).type;
  }

  private setAbilities() {
    const type = this.getUserType();

    if (type === 'admin') {
      this.abilityService.update([
        { action: 'read', subject: 'AdminPanel' }
      ]);
    } else {
      this.abilityService.update([]);
    }
  }
}