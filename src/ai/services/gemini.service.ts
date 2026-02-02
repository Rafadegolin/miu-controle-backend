import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

/**
 * Service for Google Gemini integration
 * Provides tailored functionality for Gemini 1.5 Flash and Pro
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  /**
   * Initialize Gemini client
   * @param apiKey - API key
   * @param modelName - Model name (gemini-2.5-flash, gemini-2.5-pro, etc)
   */
  initializeClient(
    apiKey: string,
    modelName: string = 'gemini-2.5-flash',
  ): GenerativeModel {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Safety settings can be adjusted here if needed
    return genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.3,
      },
    });
  }

  /**
   * Create chat completion
   */
  async createChatCompletion(
    model: GenerativeModel,
    messages: { role: 'user' | 'model' | 'system'; content: string }[],
  ): Promise<{
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    const maxRetries = 3;
    let baseDelay = 2000; // 2 seconds

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Extract system instruction if present (Gemini handles system prompts differently in SDK)
        const systemMessage = messages.find((m) => m.role === 'system');
        const chatHistory = messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
          }));

        // If system instruction exists, we might need to recreate the model with it
        // but for simplicity in this version, we prepend it to the first user message
        // or rely on the model's instruction support if initialized with it.
        // Current SDK allows system_instruction on getGenerativeModel.
        // For per-request system prompts, prepending is a common pattern for now if not re-initializing.

        if (systemMessage && chatHistory.length > 0) {
          chatHistory[0].parts[0].text = `${systemMessage.content}\n\n${chatHistory[0].parts[0].text}`;
        }

        const chat = model.startChat({
          history: chatHistory.slice(0, -1), // All except last one
        });

        const lastMessage = chatHistory[chatHistory.length - 1].parts[0].text;
        const result = await chat.sendMessage(lastMessage);
        const response = await result.response;
        const text = response.text();

        // Gemini doesn't always return exact token usage in the main response object in all versions/regions
        // checking metadata if available, otherwise estimating
        const usage = {
          promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
          completionTokens:
            result.response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: result.response.usageMetadata?.totalTokenCount || 0,
        };

        this.logger.debug(`Gemini completion: tokens=${usage.totalTokens}`);

        return {
          content: text,
          usage,
        };
      } catch (error) {
        const errorMessage = error?.message || '';
        const isRateLimit =
          errorMessage.includes('429') ||
          errorMessage.includes('limit') ||
          errorMessage.includes('quota');
        const isTransient =
          errorMessage.includes('503') || errorMessage.includes('overloaded');

        if ((isRateLimit || isTransient) && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          this.logger.warn(
            `Gemini rate limited (Attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        this.handleGeminiError(error);
        throw error;
      }
    }
  }

  /**
   * Handle Gemini API errors
   */
  private handleGeminiError(error: any): void {
    const errorMessage = error?.message || 'Unknown error';

    this.logger.error(`Gemini error: ${errorMessage}`);

    if (errorMessage.includes('API key')) {
      throw new HttpException(
        'API key do Gemini inválida.',
        HttpStatus.UNAUTHORIZED,
      );
    } else if (
      errorMessage.includes('429') ||
      errorMessage.includes('Too Many Requests') ||
      errorMessage.includes('quota') ||
      errorMessage.includes('Quota exceeded') ||
      errorMessage.includes('limit') ||
      errorMessage.includes('rate limit')
    ) {
      // Throw a special error that can be caught for fallback
      const quotaError = new HttpException(
        'Limite de requisições do Gemini excedido. Tente novamente em alguns segundos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
      (quotaError as any).isQuotaError = true; // Flag for fallback detection
      throw quotaError;
    } else {
      throw new HttpException(
        'Erro na comunicação com o Gemini AI.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test API key
   */
  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const model = this.initializeClient(apiKey, 'gemini-2.5-flash');
      await model.generateContent('Test');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate cost for Gemini models
   */
  calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    // Pricing (Dec 2024 approximation) per 1M tokens
    let inputPrice = 0.075;
    let outputPrice = 0.3;

    if (model.includes('pro')) {
      inputPrice = 1.25;
      outputPrice = 5.0;
    }

    return (
      (promptTokens / 1_000_000) * inputPrice +
      (completionTokens / 1_000_000) * outputPrice
    );
  }
  /**
   * Refine text using Gemini
   */
  async enhanceText(text: string, apiKey: string): Promise<string> {
    try {
      const model = this.initializeClient(apiKey, 'gemini-2.5-flash');

      const prompt = `Você é um consultor financeiro pessoal experiente e empático.
      Melhore a seguinte recomendação financeira para torná-la mais clara, acionável e motivadora para o usuário.
      Mantenha o tom profissional mas amigável. Seja conciso (máximo 2 frases).
      
      Recomendação original: "${text}"`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      this.logger.warn(`Failed to enhance text with Gemini: ${error.message}`);
      return text; // Fallback to original text
    }
  }
}
