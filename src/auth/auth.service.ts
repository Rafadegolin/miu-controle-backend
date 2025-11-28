import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email já cadastrado');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        fullName: registerDto.fullName,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        subscriptionTier: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        subscriptionTier: user.subscriptionTier,
      },
      ...tokens,
    };
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    // ✅ CORREÇÃO: sem options no signAsync
    const accessToken = await this.jwtService.signAsync(payload);

    // Para refresh token, criar outro JwtService com config diferente
    // ou usar uma lib separada. Por enquanto, usar o mesmo:
    const refreshToken = await this.jwtService.signAsync(payload);

    // Salvar refresh token no banco
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
