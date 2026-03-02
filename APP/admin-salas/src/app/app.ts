import { Component, signal, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { AdminSalasComponent } from './components/admin-salas/admin-salas';
import { AdminUsersComponent } from './components/admin-users/admin-users';

type Tab = 'salas' | 'usuarios';

type JwtPayload = {
  sub?: string;
  type?: string;
  exp?: number;
};

function safeBase64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;

  const decoded = atob(padded);
  try {
    return decodeURIComponent(
      decoded
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return decoded;
  }
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = safeBase64UrlDecode(parts[1]);
    return JSON.parse(payloadJson) as JwtPayload;
  } catch {
    return null;
  }
}

function isExpired(payload: JwtPayload): boolean {
  if (!payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule, AdminSalasComponent, AdminUsersComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App implements OnInit {
  activeTab = signal<Tab>('salas');

  // ✅ auth states
  isAllowed = signal<boolean>(false);
  isChecking = signal<boolean>(true);

  private readonly usersApi = 'http://100.80.240.31:3001/users';

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private http: HttpClient
  ) {}

  async ngOnInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      this.isAllowed.set(false);
      this.isChecking.set(false);
      return;
    }

    // 1) Import token from URL if present
    const url = new URL(window.location.href);
    const tokenFromUrl = url.searchParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }

    // 2) Verify permission against backend
    await this.verifyAdminAgainstBackend();

    this.isChecking.set(false);
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
  }

  private async verifyAdminAgainstBackend(): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) {
      this.isAllowed.set(false);
      return;
    }

    const payload = decodeJwtPayload(token);
    if (!payload?.sub) {
      localStorage.removeItem('token');
      this.isAllowed.set(false);
      return;
    }

    if (isExpired(payload)) {
      localStorage.removeItem('token');
      this.isAllowed.set(false);
      return;
    }

    try {
      // ✅ REAL check: fetch user by id and check type
      const user = await firstValueFrom(this.http.get<any>(`${this.usersApi}/${payload.sub}`));

      const isAdmin = user?.type === 'admin';
      this.isAllowed.set(isAdmin);

      if (!isAdmin) {
        localStorage.removeItem('token');
      }
    } catch {
      // if request fails -> deny
      localStorage.removeItem('token');
      this.isAllowed.set(false);
    }
  }
}