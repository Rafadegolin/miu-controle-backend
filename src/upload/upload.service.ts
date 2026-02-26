import { Injectable, BadRequestException } from '@nestjs/common';
import { MinioService } from './minio.service';
import 'multer';

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
  /**
   * Upload genérico para qualquer bucket
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    bucket?: string,
  ): Promise<string> {
    return this.minioService.uploadFile(file, folder, bucket);
  }

  /**
   * Valida arquivo de comprovante para OCR
   * Aceita: JPG, PNG, WEBP, PDF, HEIC — até 10MB
   */
  validateReceiptFile(file: Express.Multer.File): void {
    const ALLOWED_RECEIPT_MIME_TYPES = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf',
    ];

    const MAX_RECEIPT_SIZE = 10 * 1024 * 1024; // 10MB

    if (!file) {
      throw new BadRequestException('Imagem obrigatória');
    }

    if (!ALLOWED_RECEIPT_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato inválido. Use: JPG, PNG, WEBP, HEIC ou PDF',
      );
    }

    if (file.size > MAX_RECEIPT_SIZE) {
      throw new BadRequestException('Arquivo muito grande. Máximo: 10MB');
    }
  }

  /**
   * Faz upload de comprovante no MinIO e retorna a URL pública
   */
  async uploadReceiptFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    this.validateReceiptFile(file);
    const folder = `receipts/${userId}`;
    return this.minioService.uploadFile(file, folder);
  }
}
