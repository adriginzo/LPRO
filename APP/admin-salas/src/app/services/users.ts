import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserAdmin {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  dni: string;
  school: string;
  degree: string;
  phone: string;
  type: 'user' | 'admin' | string;

  // Solo para crear/actualizar si quieres cambiarlo
  password?: string;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private apiUrl = 'http://100.80.240.31:3001/users';

  constructor(private http: HttpClient) {}

  getUsers(): Observable<UserAdmin[]> {
    return this.http.get<UserAdmin[]>(this.apiUrl);
  }

  createUser(user: UserAdmin): Observable<UserAdmin> {
    return this.http.post<UserAdmin>(this.apiUrl, user);
  }

  updateUser(id: string, user: Partial<UserAdmin>): Observable<UserAdmin> {
    return this.http.put<UserAdmin>(`${this.apiUrl}/${id}`, user);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  deleteAllUsers(): Observable<void> {
    return this.http.delete<void>(this.apiUrl);
  }
}