// src/app.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/usersdb'),
    UsersModule,
  ],
})
export class AppModule {}