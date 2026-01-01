import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiUsageService } from './ai-usage.service';
import { OpenAiService } from './openai.service';
import { GeminiService } from './gemini.service';
import { AiKeyManagerService } from './ai-key-manager.service';
import { OpenAI } from 'openai';

/**
 * AI Categorization Service
 * 
 * Automatically categorize transactions using either OpenAI or Gemini based on user preference.
 * - Uses AiKeyManager for key retrieval and model selection
 * - Supports fallback logic (future)
 * - Threshold: Only applies category if confidence >= 0.7
 */
@Injectable()
export class AiCategorizationService {
  private readonly logger = new Logger(AiCategorizationService.name);

  constructor(
    private prisma: PrismaService,
    private aiUsageService: AiUsageService,
    private openAiService: OpenAiService,
    private geminiService: GeminiService,
    private aiKeyManager: AiKeyManagerService,
  ) {}

  /**
   * Categorize a transaction using AI
   * @param userId - User ID
   * @param transaction - Transaction data
   * @returns Category ID, confidence, and reasoning
   */
  async categorizeTransaction(
    userId: string,
    transaction: {
      id?: string;
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
      // 1. Get API Key and Configuration via Key Manager
      // This handles FREE vs PAID logic and model selection automagically
      const { apiKey, provider, model } = await this.aiKeyManager.getApiKey(
        userId,
        'CATEGORIZATION',
      );

      // 2. Get user's categories
      const userCategories = await this.getUserCategories(userId);
      if (userCategories.length === 0) {
        return {
          categoryId: null,
          confidence: 0,
          reasoning: 'Usuário não possui categorias cadastradas',
        };
      }

      // 3. Get similar historical transactions for context
      const similarTransactions = await this.getSimilarTransactions(
        userId,
        transaction.description,
      );

      // 4. Build Prompt
      // (The prompt structure is compatible with both LLMs)
      const { systemPrompt, userPrompt } = this.buildPrompts(
        transaction,
        userCategories,
        similarTransactions,
      );

      let aiResponseContent = '';
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      // 5. Call the appropriate AI Provider
      if (provider === 'OPENAI') {
        const client = this.openAiService.initializeClient(apiKey);
        const response = await this.openAiService.createChatCompletion(
          client,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          model,
        );

        aiResponseContent = response.choices[0]?.message?.content || '';
        usage = {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        };
      } else {
        // GEMINI
        const client = this.geminiService.initializeClient(apiKey, model);
        const response = await this.geminiService.createChatCompletion(client, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);

        aiResponseContent = response.content;
        usage = response.usage;
      }

      // 6. Parse Response
      const result = this.parseAiResponse(aiResponseContent, userCategories);

      // 7. Track Usage
      await this.aiUsageService.trackUsage(
        userId,
        'CATEGORIZATION',
        {
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.totalTokens,
        },
        model,
        transaction.id,
      );

      this.logger.debug(
        `AI Categorization (${provider}/${model}): user=${userId}, cat=${result.categoryId}, conf=${result.confidence}`,
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
        'unknown',
        error.message,
      );

      return {
        categoryId: null,
        confidence: 0,
        reasoning: `Erro na categorização: ${error.message}`,
      };
    }
  }

  // ... (Helper methods remain similar but adapted for composition) ...

  private async getUserCategories(userId: string) {
    return this.prisma.category.findMany({
      where: {
        OR: [
          { userId },
          { isSystem: true },
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

  private async getSimilarTransactions(userId: string, description: string) {
    const recentTransactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId: { not: null },
      },
      include: {
        category: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    if (recentTransactions.length === 0) return [];

    const keywords = description.toLowerCase().split(' ');
    return recentTransactions
      .map((t) => {
        const descLower = t.description.toLowerCase();
        const matchCount = keywords.filter((k) => descLower.includes(k)).length;
        return {
          transaction: t,
          similarity: matchCount / keywords.length,
        };
      })
      .filter((t) => t.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map((t) => t.transaction);
  }

  private buildPrompts(
    transaction: { description: string; amount: number; merchant?: string; date: Date },
    userCategories: any[],
    similarTransactions: any[],
  ): { systemPrompt: string; userPrompt: string } {
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
- Considere o tipo da transação (EXPENSE, INCOME, TRANSFER)

FORMATO DE RESPOSTA (JSON):
{
  "categoryId": "uuid-da-categoria" ou null,
  "confidence": 0.85,
  "reasoning": "Breve explicação"
}`;

    let userPrompt = `Categorize a seguinte transação:
📝 TRANSAÇÃO:
- Descrição: "${transaction.description}"
- Valor: R$ ${transaction.amount.toFixed(2)}`;

    if (transaction.merchant) userPrompt += `\n- Estabelecimento: ${transaction.merchant}`;
    
    userPrompt += `\n- Data: ${transaction.date.toLocaleDateString('pt-BR')}
    
📁 CATEGORIAS DISPONÍVEIS:`;

    userCategories.forEach((cat) => {
      userPrompt += `\n- ${cat.id}: ${cat.name} (${cat.type})`;
    });

    if (similarTransactions.length > 0) {
      userPrompt += `\n\n📊 HISTÓRICO:`;
      similarTransactions.forEach((t) => {
        userPrompt += `\n- "${t.description}" (R$ ${Number(t.amount).toFixed(2)}) → ${t.category.name}`;
      });
    }

    return { systemPrompt, userPrompt };
  }

  private parseAiResponse(
    content: string,
    userCategories: Array<{ id: string; name: string }>,
  ): {
    categoryId: string | null;
    confidence: number;
    reasoning: string;
  } {
    if (!content) {
      return { categoryId: null, confidence: 0, reasoning: 'Resposta vazia da IA' };
    }

    try {
      // Find JSON object in response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
         // Fallback default
         return { categoryId: null, confidence: 0, reasoning: 'Formato inválido' };
      }

      const json = JSON.parse(jsonMatch[0]);
      const confidence = Math.max(0, Math.min(1, Number(json.confidence) || 0));

      if (confidence < 0.7) {
        return { categoryId: null, confidence, reasoning: json.reasoning || 'Confiança baixa' };
      }

      if (json.categoryId) {
        const categoryExists = userCategories.some(c => c.id === json.categoryId);
        if (!categoryExists) {
          return { categoryId: null, confidence: 0, reasoning: 'Categoria inexistente' };
        }
      }

      return {
        categoryId: json.categoryId || null,
        confidence,
        reasoning: json.reasoning || '',
      };
    } catch (e) {
      return { categoryId: null, confidence: 0, reasoning: 'Erro no parse' };
    }
  }
}
