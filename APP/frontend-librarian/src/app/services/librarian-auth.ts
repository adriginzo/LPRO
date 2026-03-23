import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

type LoginResponse = {
  access_token?: string;
  token?: string;
  user?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    type?: string;
  };
};

export type LibrarianUser = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  type: string;
};

export type LibrarianSession = {
  token: string;
  user: LibrarianUser;
};

@Injectable({
  providedIn: 'root'
})
export class LibrarianAuthService {
  private readonly apiUrl = 'http://100.80.240.31:3001/users';
  private readonly storageKey = 'librarian_session';

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<LibrarianSession> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        map((response) => {
          const token = response.access_token ?? response.token ?? '';
          const tokenPayload = token ? this.readTokenPayload(token) : null;

          const user: LibrarianUser = {
            _id: response.user?._id ?? tokenPayload?.sub ?? tokenPayload?.id ?? '',
            firstName: response.user?.firstName ?? tokenPayload?.firstName ?? '',
            lastName: response.user?.lastName ?? tokenPayload?.lastName ?? '',
            email: response.user?.email ?? tokenPayload?.email ?? email,
            type: response.user?.type ?? tokenPayload?.type ?? ''
          };

          const session: LibrarianSession = {
            token,
            user
          };

          localStorage.setItem(this.storageKey, JSON.stringify(session));
          return session;
        })
      );
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
  }

  getSession(): LibrarianSession | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as LibrarianSession;

      if (!parsed?.user && parsed?.token) {
        const tokenPayload = this.readTokenPayload(parsed.token);

        return {
          token: parsed.token,
          user: {
            _id: tokenPayload?.sub ?? tokenPayload?.id ?? '',
            firstName: tokenPayload?.firstName ?? '',
            lastName: tokenPayload?.lastName ?? '',
            email: tokenPayload?.email ?? '',
            type: tokenPayload?.type ?? ''
          }
        };
      }

      return parsed;
    } catch {
      this.logout();
      return null;
    }
  }

  getToken(): string | null {
    return this.getSession()?.token ?? null;
  }

  isLibrarian(): boolean {
    const type = this.getSession()?.user?.type ?? '';
    return type.toLowerCase() === 'librarian';
  }

  private readTokenPayload(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;

      const base64 = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');

      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }
}