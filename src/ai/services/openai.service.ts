import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';

/**
 * Base service for OpenAI integration
 * Provides common functionality for all AI features
 * 
 * SECURITY:
 * - Never logs API keys
 * - Implements timeout and retry logic
 * - Tracks token usage for all completions
 */
@Injectable()
export class OpenAiService {
  protected readonly logger = new Logger(OpenAiService.name);

  /**
   * Initialize OpenAI client with user's decrypted API key
   * @param apiKey - Decrypted API key (from EncryptionService)
   * @returns OpenAI client instance
   */
  public initializeClient(apiKey: string): OpenAI {
    if (!apiKey || !apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format');
    }

    return new OpenAI({
      apiKey,
      timeout: 30000, // 30s timeout
      maxRetries: 2, // Retry failed requests twice
    });
  }

  /**
   * Create chat completion with comprehensive error handling
   * @param client - OpenAI client instance
   * @param messages - Chat messages
   * @param model - Model to use (default: gpt-4o-mini)
   * @param options - Additional options
   * @returns Chat completion response
   */
  public async createChatCompletion(
    client: OpenAI,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    model: string = 'gpt-4o-mini',
    options?: Partial<OpenAI.Chat.ChatCompletionCreateParams>,
  ): Promise<OpenAI.Chat.ChatCompletion> {
    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.3, // Low temperature for consistency
        max_tokens: 500,
        stream: false, // Ensure we get complete response, not streaming
        ...options,
      }) as OpenAI.Chat.ChatCompletion; // Type assertion since stream: false

      // Log usage (without sensitive data)
      this.logger.debug(
        `OpenAI completion: model=${model}, tokens=${response.usage?.total_tokens || 0}`,
      );

      return response;
    } catch (error) {
      this.handleOpenAiError(error);
      throw error; // Re-throw after logging
    }
  }

  /**
   * Handle OpenAI API errors with specific error messages
   * @param error - Error from OpenAI API
   */
  public handleOpenAiError(error: any): void {
    // Never log the full error (may contain API key)
    const errorMessage = error?.message || 'Unknown error';
    const statusCode = error?.status || error?.response?.status;

    if (statusCode === 401) {
      this.logger.error('OpenAI API authentication failed - invalid API key');
      throw new Error('API key inválida. Verifique suas configurações.');
    } else if (statusCode === 429) {
      this.logger.error('OpenAI rate limit exceeded');
      throw new Error(
        'Limite de requisições excedido. Tente novamente em alguns minutos.',
      );
    } else if (statusCode === 500 || statusCode === 503) {
      this.logger.error('OpenAI server error');
      throw new Error(
        'Erro no servidor da OpenAI. Tente novamente mais tarde.',
      );
    } else if (errorMessage.includes('timeout')) {
      this.logger.error('OpenAI request timeout');
      throw new Error(
        'Tempo de resposta excedido. Tente novamente.',
      );
    } else {
      this.logger.error(`OpenAI error (${statusCode}): ${errorMessage}`);
      throw new Error(
        'Erro na comunicação com a IA. Por favor, tente novamente.',
      );
    }
  }

  /**
   * Test if API key is valid by making a minimal request
   * @param apiKey - Decrypted API key to test
   * @returns true if key is valid
   */
  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const client = this.initializeClient(apiKey);
      
      // Make minimal request to test key
      await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate estimated cost based on token usage
   * Prices as of December 2024 for gpt-4o-mini
   * @param promptTokens - Number of prompt tokens
   * @param completionTokens - Number of completion tokens
   * @returns Estimated cost in USD
   */
  public calculateCost(
    promptTokens: number,
    completionTokens: number,
  ): number {
    // gpt-4o-mini pricing (per 1M tokens)
    const INPUT_PRICE = 0.15; // $0.15 per 1M tokens
    const OUTPUT_PRICE = 0.60; // $0.60 per 1M tokens

    const promptCost = (promptTokens / 1_000_000) * INPUT_PRICE;
    const completionCost = (completionTokens / 1_000_000) * OUTPUT_PRICE;

    return promptCost + completionCost;
  }
}
