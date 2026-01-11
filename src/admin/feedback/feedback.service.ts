import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeedbackDto, FeedbackType } from './dto/create-feedback.dto';
import { UpdateFeedbackStatusDto, FeedbackStatus } from './dto/update-feedback-status.dto';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateFeedbackDto) {
    return this.prisma.feedback.create({
      data: {
        userId,
        type: dto.type as any, // Cast to match Prisma Enum
        title: dto.title,
        description: dto.description,
        attachments: dto.attachments || [],
        status: 'PENDING',
      },
    });
  }

  async findAll(filters: { status?: FeedbackStatus; type?: FeedbackType } = {}) {
    return this.prisma.feedback.findMany({
      where: {
        status: filters.status ? (filters.status as any) : undefined,
        type: filters.type ? (filters.type as any) : undefined,
      },
      include: {
        user: { select: { fullName: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, dto: UpdateFeedbackStatusDto, adminId: string) {
    return this.prisma.feedback.update({
      where: { id },
      data: {
        status: dto.status as any,
        adminResponse: dto.adminResponse,
        adminId,
      },
    });
  }

  async getMyFeedback(userId: string) {
    return this.prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }
}
