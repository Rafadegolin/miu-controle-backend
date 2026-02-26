import {
  Injectable,
  Logger,
  UnprocessableEntityException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from './gemini.service';
import { AiKeyManagerService } from './ai-key-manager.service';
import { AiUsageService } from './ai-usage.service';
import { AiFeatureType } from '@prisma/client';
import { ReceiptPreviewDto } from '../../transactions/dto/receipt-analysis-response.dto';

export interface ReceiptAnalysisResult {
  description: string | null;
  amount: number | null;
  type: 'EXPENSE' | 'INCOME';
  date: string | null;
  merchant: string | null;
  categoryId: string | null;
  categoryName: string | null;
  confidence: number;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  rawText: string | null;
}

/**
 * Service dedicated to OCR analysis of receipt images using Gemini Vision.
 */
@Injectable()
export class ReceiptOcrService {
  private readonly logger = new Logger(ReceiptOcrService.name);
  private readonly MODEL = 'gemini-2.5-flash';

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly aiKeyManagerService: AiKeyManagerService,
    private readonly aiUsageService: AiUsageService,
  ) {}

  /**
   * Analyze a receipt image and extract financial data.
   * @param imageBuffer - Raw buffer of the image/PDF
   * @param mimeType    - MIME type (image/jpeg, image/png, image/webp, application/pdf, image/heic)
   * @param userId      - User ID (to load categories and track usage)
   * @returns Extracted receipt data to be confirmed by the user
   */
  async analyze(
    imageBuffer: Buffer,
    mimeType: string,
    userId: string,
  ): Promise<ReceiptPreviewDto> {
    const startTime = Date.now();

    // 1. Load user categories for AI context (user's own + system categories)
    const categories = await this.prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      select: { id: true, name: true },
    });

    // 2. Get API key
    let apiKeyConfig: Awaited<ReturnType<AiKeyManagerService['getApiKey']>>;
    try {
      apiKeyConfig = await this.aiKeyManagerService.getApiKey(
        userId,
        AiFeatureType.OCR,
      );
    } catch {
      throw new ServiceUnavailableException(
        'Serviço de IA temporariamente indisponível',
      );
    }

    // 3. Call Gemini Vision
    let rawResult: ReceiptAnalysisResult;
    try {
      rawResult = await this.geminiService.analyzeReceiptImage(
        imageBuffer,
        mimeType,
        categories,
        apiKeyConfig.apiKey,
      );
    } catch (error: any) {
      this.logger.error(`Gemini OCR error: ${error?.message}`);

      await this.aiUsageService.trackFailure(
        userId,
        AiFeatureType.OCR,
        this.MODEL,
        error?.message ?? 'Unknown OCR error',
      );

      if (
        error?.status === 503 ||
        (error?.message as string)?.includes('503')
      ) {
        throw new ServiceUnavailableException(
          'Serviço de IA temporariamente indisponível',
        );
      }

      throw new UnprocessableEntityException(
        'Não foi possível extrair dados do comprovante. Tente uma foto mais nítida.',
      );
    }

    // 4. Validate confidence — warn but don't reject
    if (!rawResult || rawResult.confidence < 0.2) {
      throw new UnprocessableEntityException(
        'Não foi possível extrair dados do comprovante. Tente uma foto mais nítida.',
      );
    }

    // 5. Estimate token usage for tracking (Gemini Vision doesn't always return exact counts)
    const estimatedTokens = Math.ceil(imageBuffer.length / 100) + 500;
    await this.aiUsageService.trackUsage(
      userId,
      AiFeatureType.OCR,
      {
        prompt_tokens: estimatedTokens,
        completion_tokens: 300,
        total_tokens: estimatedTokens + 300,
      },
      this.MODEL,
    );

    const processingMs = Date.now() - startTime;
    this.logger.log(
      `OCR completed for user=${userId} in ${processingMs}ms confidence=${rawResult.confidence}`,
    );

    return rawResult as ReceiptPreviewDto;
  }
}
