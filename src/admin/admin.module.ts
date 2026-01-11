import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheHelperModule } from '../common/cache.module';
import { ReleaseNotesModule } from './release-notes/release-notes.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [PrismaModule, CacheHelperModule, ReleaseNotesModule, FeedbackModule],
  controllers: [AdminController],
})
export class AdminModule {}
