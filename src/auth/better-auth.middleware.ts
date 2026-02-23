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
import { toNodeHandler } from 'better-auth/node';
import { auth } from './better-auth.config';

const betterAuthHandler = toNodeHandler(auth);

@Injectable()
export class BetterAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // toNodeHandler retorna (req, res) — sem next.
    // Este middleware é aplicado SOMENTE em /api/auth/* onde o Better Auth
    // é o único responsável (signin, callback, get-session, sign-out).
    betterAuthHandler(req as any, res as any);
  }
}
