// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para Angular
  app.enableCors({
    origin: '*', // Para desarrollo puedes usar '*'. En producción restringe al dominio del frontend
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  await app.listen(3000, '0.0.0.0'); // Escuchar en todas las interfaces de red
}
bootstrap();