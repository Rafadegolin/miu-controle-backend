import { Module } from '@nestjs/common';
import { MinioService } from './minio.service';
import { UploadService } from './upload.service';

@Module({
  providers: [MinioService, UploadService],
  exports: [UploadService], // Disponível para outros módulos
})
export class UploadModule {}
