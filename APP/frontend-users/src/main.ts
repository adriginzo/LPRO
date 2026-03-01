import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';

import { AppComponent } from './app/app';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    // ✅ Esto evita "Cannot GET /ruta" al refrescar en producción
    provideRouter(routes, withHashLocation()),
  ],
}).catch(err => console.error(err));