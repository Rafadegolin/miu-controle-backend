import { Injectable, BadRequestException } from '@nestjs/common';
import { MinioService } from './minio.service';

@Injectable()
export class UploadService {
  // Tipos de imagem permitidos
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  // Tamanho máximo: 5MB
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;

  constructor(private minioService: MinioService) {}

  /**
   * Valida e faz upload de avatar
   */
  async uploadAvatar(file: Express.Multer.File): Promise<string> {
    // Validar tipo de arquivo
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Formato inválido. Use: JPG, PNG ou WEBP');
    }

    // Validar tamanho
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('Arquivo muito grande. Máximo: 5MB');
    }

    // Upload no MinIO
    return this.minioService.uploadFile(file, 'avatars');
  }

  /**
   * Valida e faz upload de imagem de meta
   */
  async uploadGoalImage(
    file: Express.Multer.File,
    userId: string,
    goalId: string,
  ): Promise<{ url: string; key: string; mimeType: string; size: number }> {
    // Validar tipo de arquivo
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Formato inválido. Use: JPG, PNG ou WEBP');
    }

    // Validar tamanho
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('Arquivo muito grande. Máximo: 5MB');
    }

    // Upload no MinIO com path organizado
    const path = `goals/${userId}/${goalId}`;
    const url = await this.minioService.uploadFile(file, path);

    return {
      url,
      key: `${path}/${file.originalname}`,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  /**
   * Deleta avatar antigo
   */
  async deleteAvatar(avatarUrl: string): Promise<void> {
    return this.minioService.deleteFile(avatarUrl);
  }

  /**
   * Deleta imagem de meta
   */
  async deleteGoalImage(imageKey: string): Promise<void> {
    return this.minioService.deleteFile(imageKey);
  }
}
