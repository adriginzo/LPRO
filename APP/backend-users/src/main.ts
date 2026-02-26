import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔹 Permitir CORS desde Angular
  app.enableCors({
    origin: '*', // o '*' para cualquier origen (no recomendado en prod)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(3001);
  console.log('Backend running on http://localhost:3001');
}
bootstrap();