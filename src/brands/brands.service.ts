import { Injectable, Logger } from '@nestjs/common';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(private prisma: PrismaService) {}

  async create(createBrandDto: CreateBrandDto) {
    return this.prisma.brand.create({
      data: {
        ...createBrandDto,
        logoUrl: createBrandDto.logoUrl || '',
      },
    });
  }

  async findAll() {
    return this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.brand.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateBrandDto: UpdateBrandDto) {
    return this.prisma.brand.update({
      where: { id },
      data: updateBrandDto,
    });
  }

  async updateLogo(id: string, logoUrl: string) {
    return this.prisma.brand.update({
        where: { id },
        data: { logoUrl }
    });
  }

  async remove(id: string) {
    return this.prisma.brand.delete({
      where: { id },
    });
  }

  /**
   * Detects a brand from a transaction description
   * This is a "heavy" operation if we have thousands of brands.
   * For MVP with < 100 brands, fetching all and iterating is fast enough.
   * Future optimization: Cache this list or use Postgres Full Text Search.
   */
  async detectBrand(description: string) {
    if (!description) return null;
    
    const normalizedDesc = description.toLowerCase().trim();
    
    // Fetch all brands with patterns
    // TODO: Implement Cache logic here to avoid DB hit on every transaction
    const brands = await this.prisma.brand.findMany({
      select: { id: true, matchPatterns: true }
    });

    for (const brand of brands) {
        // Check if any pattern matches
        const isMatch = brand.matchPatterns.some(pattern => {
            const normalizedPattern = pattern.toLowerCase();
            // Basic substring match
            // Could be improved with Regex if pattern supports it
            return normalizedDesc.includes(normalizedPattern);
        });

        if (isMatch) {
            // Found a match! Return the full brand (or just ID)
            // We return ID here to let the caller populate if needed, 
            // but usually we want to return the object so we can use it immediately.
            // Let's return the simplified object or fetch full.
            return brand;
        }
    }

    return null;
  }
}
