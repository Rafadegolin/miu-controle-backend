import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../email/email.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
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

  /**
   * Solicita recuperação de senha
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    // Buscar usuário
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // SEMPRE retorna sucesso (segurança: não revela se email existe)
    if (!user) {
      return {
        message:
          'Se o email existir, você receberá instruções para redefinir sua senha.',
      };
    }

    // Invalidar tokens antigos do usuário
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Gerar token único
    const token = randomBytes(32).toString('hex');

    // Definir expiração (1 hora)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Salvar token no banco
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Enviar email
    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        token,
        user.fullName,
      );
    } catch (error) {
      // Log mas não quebra o fluxo
      console.error('Erro ao enviar email:', error);
    }

    return {
      message:
        'Se o email existir, você receberá instruções para redefinir sua senha.',
    };
  }

  /**
   * Verifica se token é válido
   */
  async verifyResetToken(token: string) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException('Token inválido');
    }

    if (resetToken.usedAt) {
      throw new BadRequestException('Token já utilizado');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestException('Token expirado');
    }

    return {
      valid: true,
      email: resetToken.user.email,
    };
  }

  /**
   * Reseta a senha com o token
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    // Buscar token
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException('Token inválido');
    }

    if (resetToken.usedAt) {
      throw new BadRequestException('Token já utilizado');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestException('Token expirado. Solicite um novo.');
    }

    // Verificar se nova senha é diferente da atual
    const isSamePassword = await bcrypt.compare(
      newPassword,
      resetToken.user.passwordHash,
    );

    if (isSamePassword) {
      throw new ConflictException('Nova senha deve ser diferente da atual');
    }

    // Hash da nova senha
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar senha e marcar token como usado
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Revogar todos os refresh tokens (força re-login)
      this.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId },
        data: { revokedAt: new Date() },
      }),
    ]);

    // Enviar email de confirmação
    try {
      await this.emailService.sendPasswordChangedEmail(
        resetToken.user.email,
        resetToken.user.fullName,
      );
    } catch (error) {
      console.error('Erro ao enviar confirmação:', error);
    }

    return {
      message: 'Senha alterada com sucesso! Faça login novamente.',
    };
  }
}
