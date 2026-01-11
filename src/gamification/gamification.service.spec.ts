import { Test, TestingModule } from '@nestjs/testing';
import { GamificationService } from './gamification.service';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from '../health-score/achievements.service';

describe('GamificationService', () => {
  let service: GamificationService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAchievementsService = {
      checkStreakBadges: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AchievementsService, useValue: mockAchievementsService },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('awardXp', () => {
      it('should add XP and not level up if threshold not reached', async () => {
          mockPrisma.user.findUnique.mockResolvedValue({ id: '1', level: 1, currentXp: 100 });
          mockPrisma.user.update.mockResolvedValue({});

          await service.awardXp('1', 50, 'Test');

          expect(mockPrisma.user.update).toHaveBeenCalledWith({
              where: { id: '1' },
              data: { currentXp: 150, level: 1 }
          });
      });

      it('should level up if XP threshold reached', async () => {
          // Level 1 needs 1000 XP. Current 950 + 100 = 1050. New XP should be 50. Level 2.
          mockPrisma.user.findUnique.mockResolvedValue({ id: '1', level: 1, currentXp: 950 });
          mockPrisma.user.update.mockResolvedValue({});

          await service.awardXp('1', 100, 'Test');

          expect(mockPrisma.user.update).toHaveBeenCalledWith({
              where: { id: '1' },
              data: { currentXp: 50, level: 2 }
          });
      });
  });
});
