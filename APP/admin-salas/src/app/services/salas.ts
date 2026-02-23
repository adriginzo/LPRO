// services/salas.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Sala {
  _id?: string;
  numeroSala: number;
  personasDentro: number;
  ruidoDb: number;
  horaEntrada: Date;
  horaSalida?: Date;
}

@Injectable({ providedIn: 'root' })
export class SalasService {
  private apiUrl = 'http://localhost:3000/salas'; // Ajusta al endpoint de tu backend

  constructor(private http: HttpClient) {}

  getSalas(): Observable<Sala[]> {
    return this.http.get<Sala[]>(this.apiUrl);
  }

  createSala(sala: Sala): Observable<Sala> {
    return this.http.post<Sala>(this.apiUrl, sala);
  }

  updateSala(id: string, sala: Sala): Observable<Sala> {
    return this.http.put<Sala>(`${this.apiUrl}/${id}`, sala);
  }

  deleteSala(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}