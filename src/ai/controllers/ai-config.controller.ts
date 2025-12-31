import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { OpenAiService } from '../services/openai.service';
import { SaveAiConfigDto, UpdateAiConfigDto, TestApiKeyDto } from '../dto/ai-config.dto';
import { CorrectCategoryDto } from '../dto/correct-category.dto';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../common/enums/audit-action.enum';
import { AuditEntity } from '../../common/enums/audit-entity.enum';

/**
 * Controller for managing AI configuration
 * Allows users to save OpenAI API keys and configure AI settings
 */
@ApiTags('AI Configuration')
@Controller('ai/config')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiConfigController {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private openAiService: OpenAiService,
    private auditService: AuditService,
  ) {}

  /**
   * Save AI configuration (API key + settings)
   */
  @Post()
  @ApiOperation({ summary: 'Save AI configuration' })
  @ApiResponse({ status: 201, description: 'Configuration saved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid API key' })
  async saveConfig(
    @CurrentUser('id') userId: string,
    @Body() dto: SaveAiConfigDto,
  ) {
    // 1. Test API key before saving
    const isValid = await this.openAiService.testApiKey(dto.openaiApiKey);
    if (!isValid) {
      throw new Error('API key inválida. Verifique sua chave OpenAI.');
    }

    // 2. Encrypt API key
    const encrypted = this.encryptionService.encrypt(dto.openaiApiKey);

    // 3. Upsert configuration
    const config = await this.prisma.userAiConfig.upsert({
      where: { userId },
      create: {
        userId,
        openaiApiKeyEncrypted: encrypted,
        isAiEnabled: dto.isAiEnabled ?? true,
        monthlyTokenLimit: dto.monthlyTokenLimit ?? 1000000,
        preferredModel: dto.preferredModel ?? 'gpt-4o-mini',
        lastTestedAt: new Date(),
        isKeyValid: true,
      },
      update: {
        openaiApiKeyEncrypted: encrypted,
        isAiEnabled: dto.isAiEnabled ?? true,
        monthlyTokenLimit: dto.monthlyTokenLimit,
        preferredModel: dto.preferredModel,
        lastTestedAt: new Date(),
        isKeyValid: true,
      },
    });

    // 📝 Audit log
    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entity: AuditEntity.AI_CONFIG,
      entityId: config.id,
      after: { isAiEnabled: config.isAiEnabled, preferredModel: config.preferredModel },
    });

    return {
      message: 'Configuração de IA salva com sucesso',
      config: {
        isAiEnabled: config.isAiEnabled,
        monthlyTokenLimit: config.monthlyTokenLimit,
        preferredModel: config.preferredModel,
        lastTestedAt: config.lastTestedAt,
      },
    };
  }

  /**
   * Get current AI configuration (without API key)
   */
  @Get()
  @ApiOperation({ summary: 'Get AI configuration' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved' })
  @ApiResponse({ status: 404, description: 'No configuration found' })
  async getConfig(@CurrentUser('id') userId: string) {
    const config = await this.prisma.userAiConfig.findUnique({
      where: { userId },
      select: {
        isAiEnabled: true,
        monthlyTokenLimit: true,
        preferredModel: true,
        lastTestedAt: true,
        isKeyValid: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!config) {
      return {
        configured: false,
        message: 'Nenhuma configuração de IA encontrada',
      };
    }

    return {
      configured: true,
      ...config,
    };
  }

  /**
   * Update AI configuration (settings only, not API key)
   */
  @Patch()
  @ApiOperation({ summary: 'Update AI configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  async updateConfig(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateAiConfigDto,
  ) {
    const config = await this.prisma.userAiConfig.update({
      where: { userId },
      data: {
        isAiEnabled: dto.isAiEnabled,
        monthlyTokenLimit: dto.monthlyTokenLimit,
        preferredModel: dto.preferredModel,
      },
      select: {
        isAiEnabled: true,
        monthlyTokenLimit: true,
        preferredModel: true,
        updatedAt: true,
      },
    });

    // 📝 Audit log
    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.AI_CONFIG,
      after: config,
    });

    return {
      message: 'Configuração atualizada com sucesso',
      config,
    };
  }

  /**
   * Delete AI configuration (removes API key)
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete AI configuration' })
  @ApiResponse({ status: 204, description: 'Configuration deleted' })
  async deleteConfig(@CurrentUser('id') userId: string) {
    const config = await this.prisma.userAiConfig.findUnique({ where: { userId } });
    
    await this.prisma.userAiConfig.delete({
      where: { userId },
    });

    // 📝 Audit log
    if (config) {
      await this.auditService.log({
        userId,
        action: AuditAction.DELETE,
        entity: AuditEntity.AI_CONFIG,
        entityId: config.id,
        before: { isAiEnabled: config.isAiEnabled },
      });
    }
  }

  /**
   * Test an API key without saving it
   */
  @Post('test')
  @ApiOperation({ summary: 'Test OpenAI API key' })
  @ApiResponse({ status: 200, description: 'API key is valid' })
  @ApiResponse({ status: 400, description: 'API key is invalid' })
  async testKey(@Body() dto: TestApiKeyDto) {
    const isValid = await this.openAiService.testApiKey(dto.openaiApiKey);

    return {
      valid: isValid,
      message: isValid
        ? 'API key válida'
        : 'API key inválida. Verifique sua chave OpenAI.',
    };
  }
}
