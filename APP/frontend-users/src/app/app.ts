// src/app/app.ts
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.css'] // CORREGIDO: plural y con s
})
export class AppComponent { // CORREGIDO: el nombre debe ser AppComponent
  protected readonly title = signal('frontend-users');
}