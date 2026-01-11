import { Test, TestingModule } from '@nestjs/testing';
import { ReleaseNotesService } from './release-notes.service';

describe('ReleaseNotesService', () => {
  let service: ReleaseNotesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReleaseNotesService],
    }).compile();

    service = module.get<ReleaseNotesService>(ReleaseNotesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
