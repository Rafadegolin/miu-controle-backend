import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheHelperModule } from '../common/cache.module';

@Module({
  imports: [PrismaModule, CacheHelperModule],
  controllers: [AdminController],
})
export class AdminModule {}
