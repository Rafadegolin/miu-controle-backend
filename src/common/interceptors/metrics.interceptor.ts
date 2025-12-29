import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../../health/metrics.service';

/**
 * Interceptor para coletar métricas automaticamente
 * 
 * Para cada requisição:
 * - Incrementa contador total de requisições
 * - Calcula e armazena tempo de resposta
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    this.metricsService.incrementRequests();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        this.metricsService.addRequestTime(responseTime);
      }),
    );
  }
}
