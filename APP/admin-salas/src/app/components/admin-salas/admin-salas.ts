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
  nuevaSala: Sala = { 
    numeroSala: 0, 
    personasDentro: 0, 
    ruidoDb: 0, 
    horaEntrada: this.fechaLocal(new Date()), 
    horaSalida: this.fechaLocal(new Date()) 
  };

  constructor(private salasService: SalasService) {
    this.cargarSalas();
  }

  fechaLocal(date: Date): string {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0,16);
  }

  cargarSalas() {
    this.salasService.getSalas().subscribe((data) => {
      const salasConFechas = data.map(s => ({
        ...s,
        horaEntrada: s.horaEntrada ? this.fechaLocal(new Date(s.horaEntrada)) : '',
        horaSalida: s.horaSalida ? this.fechaLocal(new Date(s.horaSalida)) : ''
      }));
      this.salas.set(salasConFechas);
    });
  }

  crearSala() {
    const salaParaEnviar: Sala = {
      ...this.nuevaSala,
      horaEntrada: new Date(this.nuevaSala.horaEntrada),
      horaSalida: this.nuevaSala.horaSalida ? new Date(this.nuevaSala.horaSalida) : undefined
    };
    this.salasService.createSala(salaParaEnviar).subscribe(() => {
      this.nuevaSala = { 
        numeroSala: 0, 
        personasDentro: 0, 
        ruidoDb: 0, 
        horaEntrada: this.fechaLocal(new Date()), 
        horaSalida: this.fechaLocal(new Date())
      };
      this.cargarSalas();
    });
  }

  actualizarSala(sala: Sala) {
    if (!sala._id) return;
    const salaParaEnviar: Sala = {
      ...sala,
      horaEntrada: new Date(sala.horaEntrada),
      horaSalida: sala.horaSalida ? new Date(sala.horaSalida) : undefined
    };
    this.salasService.updateSala(sala._id, salaParaEnviar).subscribe(() => this.cargarSalas());
  }

  actualizarPersonas(sala: Sala) {
    if (!sala._id) return;
    this.salasService.updatePersonas(sala._id, sala.personasDentro).subscribe(() => this.cargarSalas());
  }

  eliminarSala(id: string) {
    this.salasService.deleteSala(id).subscribe(() => this.cargarSalas());
  }

  borrarTodasLasSalas() {
    if (!confirm('¿Estás seguro de borrar todas las salas?')) return;
    this.salasService.deleteAllSalas().subscribe(() => this.cargarSalas());
  }
}