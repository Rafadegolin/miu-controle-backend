import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * Cliente HTTP para a EvolutionAPI (WhatsApp não-oficial, baseada em Baileys).
 * Configurado por env: EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE.
 * Se as envs não estiverem setadas, o envio vira no-op (apenas loga) para não
 * derrubar a aplicação enquanto a integração não está provisionada.
 */
@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get('EVOLUTION_API_URL') &&
        this.config.get('EVOLUTION_API_KEY') &&
        this.config.get('EVOLUTION_INSTANCE'),
    );
  }

  /** Token opcional para validar os webhooks recebidos da Evolution. */
  getWebhookToken(): string | undefined {
    return this.config.get<string>('EVOLUTION_WEBHOOK_TOKEN');
  }

  /**
   * Envia uma mensagem de texto para um número (somente dígitos, com DDI).
   */
  async sendText(number: string, text: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `EvolutionAPI não configurada — mensagem para ${number} não enviada: "${text}"`,
      );
      return;
    }

    const url = this.config.get<string>('EVOLUTION_API_URL');
    const instance = this.config.get<string>('EVOLUTION_INSTANCE');
    const apiKey = this.config.get<string>('EVOLUTION_API_KEY');

    try {
      await firstValueFrom(
        this.http.post(
          `${url!.replace(/\/$/, '')}/message/sendText/${instance}`,
          { number, text },
          { headers: { apikey: apiKey, 'Content-Type': 'application/json' } },
        ),
      );
    } catch (err: any) {
      // Não propaga: a falha no envio da confirmação não deve derrubar o webhook.
      this.logger.error(
        `Falha ao enviar mensagem WhatsApp para ${number}: ${err?.message}`,
      );
    }
  }
}
