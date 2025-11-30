import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UploadService } from '../upload/upload.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  /**
   * Busca perfil completo do usuário
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        subscriptionTier: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        lastLoginAt: true,
        // Contadores
        _count: {
          select: {
            accounts: true,
            transactions: true,
            goals: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  /**
   * Atualiza dados do perfil (nome, telefone, avatar)
   */
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateProfileDto,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Perfil atualizado com sucesso',
      user,
    };
  }

  /**
   * Troca senha do usuário
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    // Buscar usuário com senha
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verificar senha atual
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    // Verificar se nova senha é diferente
    const isSamePassword = await bcrypt.compare(
      changePasswordDto.newPassword,
      user.passwordHash,
    );

    if (isSamePassword) {
      throw new ConflictException('Nova senha deve ser diferente da atual');
    }

    // Hash da nova senha
    const newPasswordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      10,
    );

    // Atualizar senha
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Revogar todos os refresh tokens (força re-login em outros dispositivos)
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    return {
      message: 'Senha alterada com sucesso. Faça login novamente.',
    };
  }

  /**
   * Deleta conta do usuário (soft delete ou hard delete)
   */
  async deleteAccount(userId: string) {
    // Verificar se usuário existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Hard delete (Prisma cascade deleta tudo relacionado)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return {
      message: 'Conta deletada com sucesso',
    };
  }

  /**
   * Atualiza foto de perfil do usuário
   */
  async updateAvatar(userId: string, file: Express.Multer.File) {
    // Buscar usuário atual
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Upload da nova foto
    const newAvatarUrl = await this.uploadService.uploadAvatar(file);

    // Deletar foto antiga se existir
    if (user.avatarUrl) {
      await this.uploadService.deleteAvatar(user.avatarUrl);
    }

    // Atualizar no banco
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: newAvatarUrl },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
      },
    });

    return {
      message: 'Foto de perfil atualizada com sucesso',
      avatarUrl: newAvatarUrl,
      user: updatedUser,
    };
  }

  /**
   * Remove foto de perfil
   */
  async removeAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (!user.avatarUrl) {
      throw new ConflictException('Usuário não possui foto de perfil');
    }

    // Deletar do MinIO
    await this.uploadService.deleteAvatar(user.avatarUrl);

    // Remover do banco
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    return {
      message: 'Foto de perfil removida com sucesso',
    };
  }
}
