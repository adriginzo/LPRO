// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/usuario.schema';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UserDto } from './dto/usuario.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService
  ) {}

  async findAll(): Promise<UserDto[]> {
    const users = await this.userModel.find().exec();
    return users.map(u => this.toDto(u));
  }

  async findOne(id: string): Promise<UserDto> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return this.toDto(user);
  }

  async create(user: User): Promise<UserDto> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const newUser = new this.userModel({ ...user, password: hashedPassword });
    const saved = await newUser.save();
    return this.toDto(saved);
  }

  async update(id: string, user: Partial<User>): Promise<UserDto> {
    if (user.password) {
      user.password = await bcrypt.hash(user.password, 10);
    }
    const updated = await this.userModel.findByIdAndUpdate(id, user, { new: true, runValidators: true }).exec();
    if (!updated) throw new NotFoundException('User not found');
    return this.toDto(updated);
  }

  async remove(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('User not found');
  }

  async removeAll(): Promise<void> {
    await this.userModel.deleteMany({});
  }

  async validateUser(email: string, password: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) return null;
    const match = await bcrypt.compare(password, user.password);
    return match ? user : null;
  }

  async login(user: UserDocument) {
    const payload = { email: user.email, sub: user._id.toString(), type: user.type };
    return { access_token: this.jwtService.sign(payload) };
  }

  private toDto(user: UserDocument): UserDto {
    const { password, ...dto } = user.toObject();
    return dto as UserDto;
  }
}