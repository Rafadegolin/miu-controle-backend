/**
 * Middleware que monta o handler do Better Auth no NestJS.
 *
 * O Better Auth expõe um handler Node.js nativo (req, res).
 * Este middleware intercepta todas as rotas /api/auth/* e as
 * delega ao Better Auth, que gerencia o fluxo OAuth do Google.
 *
 * As rotas expostas automaticamente são:
 *  GET  /api/auth/signin/google          → inicia o fluxo OAuth
 *  GET  /api/auth/callback/google        → callback após consentimento
 *  GET  /api/auth/get-session            → valida sessão ativa
 *  POST /api/auth/sign-out               → encerra sessão Better Auth
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { getAuth } from './better-auth.config';

@Injectable()
export class BetterAuthMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, _next: NextFunction) {
    const authInstance = await getAuth();
    const { toNodeHandler } = await (
      new Function('s', 'return import(s)') as (s: string) => Promise<any>
    )('better-auth/node');
    const handler = toNodeHandler(authInstance);
    handler(req as any, res as any);
  }
}
