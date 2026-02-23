// components/admin-salas/admin-salas.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { SalasService, Sala } from '../../services/salas';

@Component({
  selector: 'app-admin-salas',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './admin-salas.html',
  styleUrls: ['./admin-salas.css']
})
export class AdminSalasComponent {
  salas = signal<Sala[]>([]);
  nuevaSala: Sala = { numeroSala: 0, personasDentro: 0, ruidoDb: 0, horaEntrada: new Date() };

  constructor(private salasService: SalasService) {
    this.cargarSalas();
  }

  cargarSalas() {
    this.salasService.getSalas().subscribe((data) => this.salas.set(data));
  }

  crearSala() {
    this.salasService.createSala(this.nuevaSala).subscribe(() => {
      this.nuevaSala = { numeroSala: 0, personasDentro: 0, ruidoDb: 0, horaEntrada: new Date() };
      this.cargarSalas();
    });
  }

  eliminarSala(id: string) {
    this.salasService.deleteSala(id).subscribe(() => this.cargarSalas());
  }

  actualizarSala(sala: Sala) {
    if (!sala._id) return;
    this.salasService.updateSala(sala._id, sala).subscribe(() => this.cargarSalas());
  }
}