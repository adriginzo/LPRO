import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type Sala = {
  _id?: string;
  facultad: string;
  numeroSala: number;
  personasDentro: number;
  ruidoDb: number;
  horaEntrada: string | Date;
  horaSalida?: string | Date;
  ultimoReservadoPor?: string;
};

@Injectable({
  providedIn: 'root'
})
export class SalasService {
  private readonly apiUrl = 'http://100.80.240.31:3000/salas';

  constructor(private http: HttpClient) {}

  getSalas(): Observable<Sala[]> {
    return this.http.get<Sala[]>(this.apiUrl);
  }
}