// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';


bootstrapApplication(App, {
  providers: [
    provideHttpClient(), // <-- reemplaza HttpClientModule
    provideRouter(routes) // si usas routing
  ]
})
.catch(err => console.error(err));