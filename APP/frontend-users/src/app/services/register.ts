import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserRegisterDTO {
  firstName: string;
  lastName: string;
  email: string;
  dni: string;
  school: string;
  degree: string;
  phone: string;
  type: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class RegisterService {
  private apiUrl = 'http://100.80.240.31:3001'; // tu backend NestJS

  constructor(private http: HttpClient) {}

  registerUser(user: UserRegisterDTO): Observable<any> {
    return this.http.post(this.apiUrl, user);
  }
}