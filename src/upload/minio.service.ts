import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get('MINIO_BUCKET_NAME');
    this.publicUrl = this.configService.get('MINIO_PUBLIC_URL');

    this.minioClient = new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT'),
      port: parseInt(this.configService.get('MINIO_PORT')),
      useSSL: this.configService.get('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY'),
      secretKey: this.configService.get('MINIO_SECRET_KEY'),
    });
  }

  async onModuleInit() {
    await this.ensureBucketExists(this.bucketName);
    await this.ensureBucketExists('brand-logos');
  }

  /**
   * Garante que o bucket existe e está público
   */
  private async ensureBucketExists(bucketName: string) {
    try {
      const exists = await this.minioClient.bucketExists(bucketName);

      if (!exists) {
        await this.minioClient.makeBucket(bucketName, 'us-east-1');
        this.logger.log(`✅ Bucket "${bucketName}" criado`);
      } else {
        this.logger.log(`✅ Bucket "${bucketName}" já existe`);
      }

      // CONFIGURAR POLÍTICA PÚBLICA (sempre que iniciar)
      const publicPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      };

      await this.minioClient.setBucketPolicy(
        bucketName,
        JSON.stringify(publicPolicy),
      );

      this.logger.log(
        `✅ Política pública aplicada ao bucket "${bucketName}"`,
      );
    } catch (error) {
      this.logger.warn(
        '⚠️  MinIO não está disponível. O serviço de upload não funcionará até que o MinIO seja configurado.',
      );
      this.logger.warn(`Detalhes: ${error.message}`);
      // NÃO lançar erro para permitir que a aplicação continue funcionando
    }
  }

  /**
   * Faz upload de arquivo e retorna URL pública
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'avatars',
    bucket: string = this.bucketName,
  ): Promise<string> {
    try {
      const fileName = `${folder}/${Date.now()}-${file.originalname}`;

      await this.minioClient.putObject(
        bucket,
        fileName,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype,
        },
      );

      // URL pública correta
      const protocol =
        this.configService.get('MINIO_USE_SSL') === 'true' ? 'https' : 'http';
      const endpoint = this.configService.get('MINIO_ENDPOINT');
      const fileUrl = `${protocol}://${endpoint}/${bucket}/${fileName}`;

      this.logger.log(`✅ Arquivo enviado: ${fileUrl}`);

      return fileUrl;
    } catch (error) {
      this.logger.error('❌ Erro ao fazer upload:', error);
      throw error;
    }
  }

  /**
   * Deleta arquivo do MinIO
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extrair nome do arquivo da URL
      const fileName = fileUrl.split(`/${this.bucketName}/`)[1];

      if (!fileName) {
        this.logger.warn('URL inválida para deletar');
        return;
      }

      await this.minioClient.removeObject(this.bucketName, fileName);
      this.logger.log(`✅ Arquivo deletado: ${fileName}`);
    } catch (error) {
      this.logger.error('❌ Erro ao deletar arquivo:', error);
      // Não lançar erro para não quebrar fluxo
    }
  }
}
