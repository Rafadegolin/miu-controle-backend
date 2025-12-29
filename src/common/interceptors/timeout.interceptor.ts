import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * Interceptor que adiciona timeout global em todas as requisições
 * 
 * Timeout padrão: 30 segundos (configurável via REQUEST_TIMEOUT_MS)
 * 
 * Previne DoS e requisições infinitas que consomem recursos do servidor
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const timeoutMs = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000');

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException('Request timeout'));
        }
        return throwError(() => err);
      }),
    );
  }
}
