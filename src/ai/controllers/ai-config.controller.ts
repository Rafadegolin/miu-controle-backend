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
import { GeminiService } from '../services/gemini.service';
import { SaveAiConfigDto, UpdateAiConfigDto, TestApiKeyDto } from '../dto/ai-config.dto';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../common/enums/audit-action.enum';
import { AuditEntity } from '../../common/enums/audit-entity.enum';

/**
 * Controller for managing AI configuration
 * Allows users to save OpenAI/Gemini API keys and configure AI settings
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
    private geminiService: GeminiService,
    private auditService: AuditService,
  ) {}

  /**
   * Save AI configuration (API keys + settings)
   */
  @Post()
  @ApiOperation({ summary: 'Save AI configuration' })
  @ApiResponse({ status: 201, description: 'Configuration saved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid API key' })
  async saveConfig(
    @CurrentUser('id') userId: string,
    @Body() dto: SaveAiConfigDto,
  ) {
    let openaiEncrypted: string | undefined;
    let geminiEncrypted: string | undefined;

    // 1. Validate and Encrypt OpenAI Key
    if (dto.openaiApiKey) {
      const isValid = await this.openAiService.testApiKey(dto.openaiApiKey);
      if (!isValid) {
        throw new Error('API key OpenAI inválida.');
      }
      openaiEncrypted = this.encryptionService.encrypt(dto.openaiApiKey);
    }

    // 2. Validate and Encrypt Gemini Key
    if (dto.geminiApiKey) {
      const isValid = await this.geminiService.testApiKey(dto.geminiApiKey);
      if (!isValid) {
        throw new Error('API key Gemini inválida.');
      }
      geminiEncrypted = this.encryptionService.encrypt(dto.geminiApiKey);
    }

    // 3. Prepare data for upset
    const data = {
      isAiEnabled: dto.isAiEnabled ?? true,
      monthlyTokenLimit: dto.monthlyTokenLimit ?? 1000000,
      categorizationModel: dto.categorizationModel ?? 'gpt-4o-mini',
      analyticsModel: dto.analyticsModel ?? 'gemini-1.5-flash',
      lastTestedAt: new Date(),
      isKeyValid: true,
      // Only update keys if provided
      ...(openaiEncrypted && { openaiApiKeyEncrypted: openaiEncrypted }),
      ...(geminiEncrypted && { geminiApiKeyEncrypted: geminiEncrypted }),
    };

    // 4. Upsert configuration
    const config = await this.prisma.userAiConfig.upsert({
      where: { userId },
      create: {
        userId,
        openaiApiKeyEncrypted: openaiEncrypted, // Can be null if only gemini provided
        geminiApiKeyEncrypted: geminiEncrypted,
        isAiEnabled: data.isAiEnabled,
        monthlyTokenLimit: data.monthlyTokenLimit,
        categorizationModel: data.categorizationModel,
        analyticsModel: data.analyticsModel,
        lastTestedAt: data.lastTestedAt,
        isKeyValid: data.isKeyValid,
      },
      update: data,
    });

    // 📝 Audit log
    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entity: AuditEntity.AI_CONFIG,
      entityId: config.id,
      after: {
        isAiEnabled: config.isAiEnabled,
        categorizationModel: config.categorizationModel,
        analyticsModel: config.analyticsModel,
      },
    });

    return {
      message: 'Configuração de IA salva com sucesso',
      config: {
        isAiEnabled: config.isAiEnabled,
        monthlyTokenLimit: config.monthlyTokenLimit,
        categorizationModel: config.categorizationModel,
        analyticsModel: config.analyticsModel,
        hasOpenAiKey: !!config.openaiApiKeyEncrypted,
        hasGeminiKey: !!config.geminiApiKeyEncrypted,
        lastTestedAt: config.lastTestedAt,
      },
    };
  }

  /**
   * Get current AI configuration (without API keys)
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
        categorizationModel: true,
        analyticsModel: true,
        lastTestedAt: true,
        isKeyValid: true,
        createdAt: true,
        updatedAt: true,
        openaiApiKeyEncrypted: true,
        geminiApiKeyEncrypted: true,
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
      isAiEnabled: config.isAiEnabled,
      monthlyTokenLimit: config.monthlyTokenLimit,
      categorizationModel: config.categorizationModel,
      analyticsModel: config.analyticsModel,
      lastTestedAt: config.lastTestedAt,
      isKeyValid: config.isKeyValid,
      hasOpenAiKey: !!config.openaiApiKeyEncrypted,
      hasGeminiKey: !!config.geminiApiKeyEncrypted,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Update AI configuration (settings only, not API keys)
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
        categorizationModel: dto.categorizationModel,
        analyticsModel: dto.analyticsModel,
      },
      select: {
        isAiEnabled: true,
        monthlyTokenLimit: true,
        categorizationModel: true,
        analyticsModel: true,
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
   * Delete AI configuration (removes API keys)
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
  @ApiOperation({ summary: 'Test API key' })
  @ApiResponse({ status: 200, description: 'API key is valid' })
  @ApiResponse({ status: 400, description: 'API key is invalid' })
  async testKey(@Body() dto: TestApiKeyDto) {
    let isValid = false;
    let message = 'Nenhuma chave fornecida';

    if (dto.openaiApiKey) {
      isValid = await this.openAiService.testApiKey(dto.openaiApiKey);
      message = isValid ? 'API key OpenAI válida' : 'API key OpenAI inválida';
    } else if (dto.geminiApiKey) {
      isValid = await this.geminiService.testApiKey(dto.geminiApiKey);
      message = isValid ? 'API key Gemini válida' : 'API key Gemini inválida';
    }

    return {
      valid: isValid,
      message,
    };
  }
}
