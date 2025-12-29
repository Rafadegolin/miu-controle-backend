import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Interceptor que adiciona header X-Response-Time em todas as respostas
 * 
 * Útil para debugging e monitoramento de performance
 * 
 * @example
 * Response header: X-Response-Time: 123ms
 */
@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        response.setHeader('X-Response-Time', `${responseTime}ms`);
      }),
    );
  }
}
