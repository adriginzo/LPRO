// src/users/users.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { UsersService } from './usuarios.service';
import { User } from './schemas/usuario.schema';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() user: User) {
    return this.usersService.create(user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() user: User) {
    return this.usersService.update(id, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Delete()
  removeAll() {
    return this.usersService.removeAll();
  }
}