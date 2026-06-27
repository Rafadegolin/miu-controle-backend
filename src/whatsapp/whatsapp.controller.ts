import {
  Controller,
  Post,
  Body,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { EvolutionService } from './evolution.service';

/**
 * Webhook público chamado pela EvolutionAPI a cada mensagem recebida.
 * NÃO usa JwtAuthGuard (a Evolution não envia JWT). A autenticidade é validada
 * por um token compartilhado (EVOLUTION_WEBHOOK_TOKEN), via header `apikey` ou
 * query `?token=`. Se o token não estiver configurado, aceita mas loga um aviso.
 */
@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly evolution: EvolutionService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // não expõe no Swagger (endpoint de integração)
  @ApiOperation({ summary: 'Webhook de mensagens da EvolutionAPI' })
  async webhook(
    @Body() payload: any,
    @Headers('apikey') apikey?: string,
    @Query('token') token?: string,
  ) {
    const expected = this.evolution.getWebhookToken();
    if (expected) {
      if (apikey !== expected && token !== expected) {
        throw new UnauthorizedException('Token de webhook inválido.');
      }
    } else {
      this.logger.warn(
        'EVOLUTION_WEBHOOK_TOKEN não configurado — webhook aceito sem validação.',
      );
    }

    // Processa apenas eventos de mensagem; demais eventos são ignorados.
    const event: string | undefined = payload?.event;
    if (event && !event.includes('messages')) {
      return { received: true, ignored: event };
    }

    await this.whatsappService.handleIncomingMessage(payload);
    return { received: true };
  }
}
