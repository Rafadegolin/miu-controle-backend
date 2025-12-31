import { Module, Global } from '@nestjs/common';
import { EncryptionService } from './services/encryption.service';

/**
 * Global module for common services used across the application
 */
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class CommonModule {}
