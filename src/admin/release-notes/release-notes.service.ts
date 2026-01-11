import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReleaseNoteDto } from './dto/create-release-note.dto';

@Injectable()
export class ReleaseNotesService {
  private readonly logger = new Logger(ReleaseNotesService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateReleaseNoteDto) {
    return this.prisma.releaseNote.create({
      data: {
        version: dto.version,
        title: dto.title,
        content: dto.content,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.releaseNote.findMany({
      orderBy: { publishedAt: 'desc' },
    });
  }

  async getPendingForUser(userId: string) {
    // 1. Get all active notes
    const activeNotes = await this.prisma.releaseNote.findMany({
      where: { isActive: true },
      orderBy: { publishedAt: 'desc' }, // Show newest first? Or oldest? Typically newest.
    });

    // 2. Get read receipts for this user
    const reads = await this.prisma.userReleaseRead.findMany({
      where: { userId },
      select: { releaseNoteId: true },
    });
    
    const readIds = new Set(reads.map(r => r.releaseNoteId));

    // 3. Filter out read notes
    return activeNotes.filter(note => !readIds.has(note.id));
  }

  async markAsRead(userId: string, releaseNoteId: string) {
    try {
        return await this.prisma.userReleaseRead.create({
            data: {
                userId,
                releaseNoteId
            }
        });
    } catch (error) {
        // If already exists (unique constraint), just return payload
        return { message: 'Already read' };
    }
  }
}
