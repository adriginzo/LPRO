// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './usuarios.service';
import { UsersController } from './usuarios.controller';
import { User, UserSchema } from './schemas/usuario.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}