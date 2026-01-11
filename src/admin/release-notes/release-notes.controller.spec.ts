import { Test, TestingModule } from '@nestjs/testing';
import { ReleaseNotesController } from './release-notes.controller';

describe('ReleaseNotesController', () => {
  let controller: ReleaseNotesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReleaseNotesController],
    }).compile();

    controller = module.get<ReleaseNotesController>(ReleaseNotesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
