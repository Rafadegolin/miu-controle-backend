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
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { parseDeviceInfo } from '../common/utils/device-info.util';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  /**
   * Registro com envio automático de verificação
   */
  async register(
    registerDto: RegisterDto,
    userAgent?: string,
    ipAddress?: string,
  ) {
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
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        subscriptionTier: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Enviar email de verificação automaticamente
    await this.sendVerificationEmail(user.id, user.email, user.fullName);

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      userAgent,
      ipAddress,
    );

    return {
      user,
      ...tokens,
      message: 'Conta criada! Verifique seu email para ativar.',
    };
  }

  /**
   * Login
   */
  async login(loginDto: LoginDto, userAgent?: string, ipAddress?: string) {
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

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      userAgent,
      ipAddress,
    );

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

  /**
   * Refresh tokens
   */
  async refreshTokens(
    userId: string,
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (
      !tokenRecord ||
      tokenRecord.revokedAt ||
      tokenRecord.userId !== userId
    ) {
      throw new UnauthorizedException('Token inválido');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new UnauthorizedException('Token expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // Atualizar lastUsedAt do token atual
    await this.prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { lastUsedAt: new Date() },
    });

    return this.generateTokens(user.id, user.email, userAgent, ipAddress);
  }

  /**
   * Solicita recuperação de senha
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

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

  /**
   * Envia email de verificação (interno)
   */
  private async sendVerificationEmail(
    userId: string,
    email: string,
    fullName: string,
  ) {
    // Invalidar tokens antigos
    await this.prisma.emailVerificationToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Gerar novo token
    const token = randomBytes(32).toString('hex');

    // Expiração: 24 horas
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Salvar token
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    // Enviar email
    try {
      await this.emailService.sendEmailVerification(email, token, fullName);
    } catch (error) {
      console.error('Erro ao enviar verificação:', error);
    }
  }

  /**
   * Verifica email com token
   */
  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { token } = verifyEmailDto;

    const verificationToken =
      await this.prisma.emailVerificationToken.findUnique({
        where: { token },
        include: { user: true },
      });

    if (!verificationToken) {
      throw new BadRequestException('Token inválido');
    }

    if (verificationToken.usedAt) {
      throw new BadRequestException('Token já utilizado');
    }

    if (new Date() > verificationToken.expiresAt) {
      throw new BadRequestException('Token expirado. Solicite um novo.');
    }

    if (verificationToken.user.emailVerified) {
      throw new ConflictException('Email já verificado');
    }

    // Marcar email como verificado
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return {
      message: 'Email verificado com sucesso! 🎉',
      emailVerified: true,
    };
  }

  /**
   * Reenvia email de verificação
   */
  async resendVerification(resendVerificationDto: ResendVerificationDto) {
    const { email } = resendVerificationDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        message:
          'Se o email existir e não estiver verificado, enviaremos um novo link.',
      };
    }

    if (user.emailVerified) {
      throw new ConflictException('Email já verificado');
    }

    // Enviar novo email
    await this.sendVerificationEmail(user.id, user.email, user.fullName);

    return {
      message:
        'Se o email existir e não estiver verificado, enviaremos um novo link.',
    };
  }

  /**
   * Gera tokens JWT com informações de sessão
   */
  private async generateTokens(
    userId: string,
    email: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
        secret: this.configService.get('JWT_SECRET'),
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get('REFRESH_TOKEN_EXPIRES_IN') || '7d',
        secret: this.configService.get('REFRESH_TOKEN_SECRET'),
      }),
    ]);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Salvar com informações do dispositivo
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
        deviceInfo: userAgent ? parseDeviceInfo(userAgent) : null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        lastUsedAt: new Date(),
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
