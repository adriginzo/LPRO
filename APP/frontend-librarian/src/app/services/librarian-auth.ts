import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, switchMap } from 'rxjs';

type LoginResponse = {
  access_token?: string;
  token?: string;
  user?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    type?: string;
    school?: string;
  };
};

type BackendUser = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  type?: string;
  school?: string;
};

export type LibrarianUser = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  type: string;
  school?: string;
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
        switchMap((response) => {
          const token = response.access_token ?? response.token ?? '';
          const tokenPayload = token ? this.readTokenPayload(token) : null;

          const userId =
            response.user?._id ??
            tokenPayload?.sub ??
            tokenPayload?.id ??
            '';

          const baseSession: LibrarianSession = {
            token,
            user: {
              _id: userId,
              firstName: response.user?.firstName ?? '',
              lastName: response.user?.lastName ?? '',
              email: response.user?.email ?? tokenPayload?.email ?? email,
              type: response.user?.type ?? tokenPayload?.type ?? '',
              school: response.user?.school ?? ''
            }
          };

          if (!userId) {
            this.saveSession(baseSession);
            return of(baseSession);
          }

          return this.http.get<BackendUser>(`${this.apiUrl}/${userId}`).pipe(
            map((fullUser) => {
              const session: LibrarianSession = {
                token,
                user: {
                  _id: fullUser?._id ?? userId,
                  firstName: fullUser?.firstName ?? baseSession.user.firstName ?? '',
                  lastName: fullUser?.lastName ?? baseSession.user.lastName ?? '',
                  email: fullUser?.email ?? baseSession.user.email ?? email,
                  type: fullUser?.type ?? baseSession.user.type ?? '',
                  school: fullUser?.school ?? ''
                }
              };

              this.saveSession(session);
              return session;
            }),
            catchError(() => {
              this.saveSession(baseSession);
              return of(baseSession);
            })
          );
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

      if (!parsed?.token) {
        this.logout();
        return null;
      }

      return {
        token: parsed.token,
        user: {
          _id: parsed.user?._id ?? '',
          firstName: parsed.user?.firstName ?? '',
          lastName: parsed.user?.lastName ?? '',
          email: parsed.user?.email ?? '',
          type: parsed.user?.type ?? '',
          school: parsed.user?.school ?? ''
        }
      };
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

  private saveSession(session: LibrarianSession): void {
    localStorage.setItem(this.storageKey, JSON.stringify(session));
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