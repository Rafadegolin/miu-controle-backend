import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { AiUsageService } from './ai-usage.service';
import { OpenAiService } from './openai.service';
import { OpenAI } from 'openai';

/**
 * AI Categorization Service
 * 
 * Uses GPT-4o-mini to automatically categorize transactions based on:
 * - Transaction description, amount, merchant, date/time
 * - User's available categories
 * - Historical similar transactions
 * 
 * Threshold: Only applies category if confidence >= 0.7
 */
@Injectable()
export class AiCategorizationService extends OpenAiService {
  protected readonly logger = new Logger(AiCategorizationService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private aiUsageService: AiUsageService,
  ) {
    super();
  }

  /**
   * Categorize a transaction using AI
   * @param userId - User ID
   * @param transaction - Transaction data
   * @returns Category ID, confidence, and reasoning (or null if no confident prediction)
   */
  async categorizeTransaction(
    userId: string,
    transaction: {
      id?: string; // Optional, for tracking
      description: string;
      amount: number;
      merchant?: string;
      date: Date;
    },
  ): Promise<{
    categoryId: string | null;
    confidence: number;
    reasoning: string;
  }> {
    try {
      // 1. Check if user has AI configured
      const aiConfig = await this.prisma.userAiConfig.findUnique({
        where: { userId },
      });

      if (!aiConfig || !aiConfig.isAiEnabled) {
        this.logger.debug(`AI not configured for user ${userId}`);
        return {
          categoryId: null,
          confidence: 0,
          reasoning: 'IA não configurada para este usuário',
        };
      }

      // 2. Check monthly limit
      const withinLimit = await this.aiUsageService.checkMonthlyLimit(userId);
      if (!withinLimit) {
        this.logger.warn(`User ${userId} exceeded monthly token limit`);
        return {
          categoryId: null,
          confidence: 0,
          reasoning: 'Limite mensal de tokens excedido',
        };
      }

      // 3. Decrypt API key
      const apiKey = this.encryptionService.decrypt(
        aiConfig.openaiApiKeyEncrypted,
      );
      const client = this.initializeClient(apiKey);

      // 4. Get user's categories
      const userCategories = await this.getUserCategories(userId);
      if (userCategories.length === 0) {
        return {
          categoryId: null,
          confidence: 0,
          reasoning: 'Usuário não possui categorias cadastradas',
        };
      }

      // 5. Get similar historical transactions
      const similarTransactions = await this.getSimilarTransactions(
        userId,
        transaction.description,
      );

      // 6. Build prompt
      const messages = this.buildPrompt(
        transaction,
        userCategories,
        similarTransactions,
      );

      // 7. Call OpenAI
      const response = await this.createChatCompletion(
        client,
        messages,
        aiConfig.preferredModel,
      );

      // 8. Parse response
      const result = this.parseAiResponse(response, userCategories);

      // 9. Track usage
      if (response.usage) {
        await this.aiUsageService.trackUsage(
          userId,
          'CATEGORIZATION',
          response.usage,
          aiConfig.preferredModel,
          transaction.id,
        );
      }

      this.logger.debug(
        `AI categorization: user=${userId}, category=${result.categoryId}, confidence=${result.confidence}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `AI categorization failed for user ${userId}: ${error.message}`,
      );

      // Track failure
      await this.aiUsageService.trackFailure(
        userId,
        'CATEGORIZATION',
        'gpt-4o-mini',
        error.message,
      );

      return {
        categoryId: null,
        confidence: 0,
        reasoning: `Erro na categorização: ${error.message}`,
      };
    }
  }

  /**
   * Get user's categories
   */
  private async getUserCategories(userId: string) {
    return this.prisma.category.findMany({
      where: {
        OR: [
          { userId }, // User's custom categories
          { isSystem: true }, // System categories
        ],
      },
      select: {
        id: true,
        name: true,
        type: true,
        icon: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Get similar historical transactions for context
   */
  private async getSimilarTransactions(userId: string, description: string) {
    // Get recent transactions with categories (last 100)
    const recentTransactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId: { not: null },
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      take: 100,
    });

    if (recentTransactions.length === 0) {
      return [];
    }

    // Simple keyword matching (could be improved with vector similarity)
    const keywords = description.toLowerCase().split(' ');
    const similarTransactions = recentTransactions
      .map((t) => {
        const descLower = t.description.toLowerCase();
        const matchCount = keywords.filter((keyword) =>
          descLower.includes(keyword),
        ).length;

        return {
          transaction: t,
          similarity: matchCount / keywords.length,
        };
      })
      .filter((t) => t.similarity > 0.3) // At least 30% keyword match
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5) // Top 5 most similar
      .map((t) => t.transaction);

    return similarTransactions;
  }

  /**
   * Build prompt for OpenAI with context
   */
  private buildPrompt(
    transaction: {
      description: string;
      amount: number;
      merchant?: string;
      date: Date;
    },
    userCategories: Array<{
      id: string;
      name: string;
      type: string;
      icon: string | null;
    }>,
    similarTransactions: any[],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const systemPrompt = `Você é um assistente especializado em categorização de transações financeiras.

Sua tarefa é analisar uma transação e sugerir a categoria mais apropriada com base em:
1. Descrição da transação
2. Valor
3. Histórico de transações similares do usuário
4. Categorias disponíveis

REGRAS IMPORTANTES:
- Retorne APENAS um JSON válido, sem texto adicional
- A confiança deve estar entre 0 e 1
- Apenas sugira uma categoria se tiver confiança >= 0.7
- Se não tiver certeza, retorne confidence < 0.7 e categoryId null
- Base sua decisão principalmente no histórico do usuário
- Considere o tipo da transação (EXPENSE, INCOME, TRANSFER)

FORMATO DE RESPOSTA (JSON):
{
  "categoryId": "uuid-da-categoria" ou null,
  "confidence": 0.85,
  "reasoning": "Breve explicação (máx 100 caracteres)"
}`;

    const dayOfWeek = transaction.date.toLocaleDateString('pt-BR', {
      weekday: 'long',
    });
    const hour = transaction.date.getHours();

    let userPrompt = `Categorize a seguinte transação:

📝 TRANSAÇÃO:
- Descrição: "${transaction.description}"
- Valor: R$ ${transaction.amount.toFixed(2)}`;

    if (transaction.merchant) {
      userPrompt += `\n- Estabelecimento: ${transaction.merchant}`;
    }

    userPrompt += `\n- Data: ${transaction.date.toLocaleDateString('pt-BR')} (${dayOfWeek}, ${hour}h)

📁 CATEGORIAS DISPONÍVEIS:`;

    userCategories.forEach((cat) => {
      userPrompt += `\n- ${cat.id}: ${cat.name} (${cat.type})`;
    });

    if (similarTransactions.length > 0) {
      userPrompt += `\n\n📊 HISTÓRICO DE TRANSAÇÕES SIMILARES DO USUÁRIO:`;
      similarTransactions.forEach((t) => {
        userPrompt += `\n- "${t.description}" (R$ ${parseFloat(t.amount.toString()).toFixed(2)}) → ${t.category.name} (${t.category.type})`;
      });
    } else {
      userPrompt += `\n\n📊 Não há histórico de transações similares.`;
    }

    userPrompt += `\n\nAnalise e retorne o JSON.`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  /**
   * Parse AI response and validate
   */
  private parseAiResponse(
    response: OpenAI.Chat.ChatCompletion,
    userCategories: Array<{ id: string; name: string }>,
  ): {
    categoryId: string | null;
    confidence: number;
    reasoning: string;
  } {
    const content = response.choices[0]?.message?.content;

    if (!content) {
      return {
        categoryId: null,
        confidence: 0,
        reasoning: 'Resposta vazia da IA',
      };
    }

    try {
      // Try to extract JSON from response (AI might add markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in AI response:', content);
        return {
          categoryId: null,
          confidence: 0,
          reasoning: 'Formato de resposta inválido',
        };
      }

      const json = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (
        typeof json.confidence !== 'number' ||
        typeof json.reasoning !== 'string'
      ) {
        return {
          categoryId: null,
          confidence: 0,
          reasoning: 'Estrutura de resposta inválida',
        };
      }

      // Validate confidence range
      const confidence = Math.max(0, Math.min(1, json.confidence));

      // If confidence too low, don't suggest category
      if (confidence < 0.7) {
        return {
          categoryId: null,
          confidence,
          reasoning: json.reasoning || 'Confiança baixa',
        };
      }

      // Validate category exists
      if (json.categoryId) {
        const categoryExists = userCategories.some(
          (c) => c.id === json.categoryId,
        );

        if (!categoryExists) {
          return {
            categoryId: null,
            confidence: 0,
            reasoning: 'Categoria sugerida não existe',
          };
        }
      }

      return {
        categoryId: json.categoryId || null,
        confidence,
        reasoning: json.reasoning || 'Sem explicação',
      };
    } catch (error) {
      this.logger.error('Failed to parse AI response:', content);
      return {
        categoryId: null,
        confidence: 0,
        reasoning: 'Erro ao processar resposta da IA',
      };
    }
  }
}
