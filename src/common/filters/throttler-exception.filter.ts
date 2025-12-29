import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

/**
 * Custom exception filter for ThrottlerException (429 Too Many Requests)
 * 
 * Adiciona:
 * - Retry-After header
 * - Mensagem customizada em português
 * - Logging de violações para monitoramento
 */
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status = exception.getStatus();

    // Retry-After (60 segundos default)
    const retryAfter = 60;

    // Logging de violação de rate limit
    const ip = request.ip || request.socket.remoteAddress;
    const method = request.method;
    const url = request.url;
    console.warn(`⚠️ Rate limit excedido: ${ip} - ${method} ${url}`);

    response
      .status(status)
      .setHeader('Retry-After', retryAfter)
      .json({
        statusCode: status,
        message: 'Limite de requisições excedido. Tente novamente mais tarde.',
        error: 'Too Many Requests',
        retryAfter: `${retryAfter}s`,
      });
  }
}
