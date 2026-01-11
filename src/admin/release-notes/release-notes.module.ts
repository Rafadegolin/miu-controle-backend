import { Module } from '@nestjs/common';
import { ReleaseNotesService } from './release-notes.service';
import { ReleaseNotesController } from './release-notes.controller';

@Module({
  providers: [ReleaseNotesService],
  controllers: [ReleaseNotesController]
})
export class ReleaseNotesModule {}
