/**
 * Configuração do Better Auth — Login Social (Issue #78)
 *
 * O Better Auth é usado SOMENTE para o fluxo OAuth do Google.
 * Toda autenticação por email/senha continua no AuthService nativo.
 *
 * Modelos Prisma utilizados:
 *  - user                  → User (existente, compartilhado)
 *  - betterAuthSession     → BetterAuthSession (novo)
 *  - socialAccount         → SocialAccount (novo)
 *  - betterAuthVerification → BetterAuthVerification (novo)
 */

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

// Instância dedicada do Prisma para o Better Auth.
// Não usamos o PrismaService do NestJS aqui porque o Better Auth
// precisa de uma instância disponível antes do bootstrap do NestJS.
const prisma = new PrismaClient();

export const auth = betterAuth({
  // ─── Base URL ─────────────────────────────────────────────────────────────
  // Deve apontar para a URL onde este NestJS está acessível.
  // Dev: http://localhost:3001 | Prod: https://api.miucontrole.com.br (ou proxy)
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',

  // Segredo usado para assinar cookies/tokens internos do Better Auth
  secret: process.env.BETTER_AUTH_SECRET,

  // ─── Banco de dados via Prisma ────────────────────────────────────────────
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // ─── Mapeamento de modelos Prisma ─────────────────────────────────────────
  // Informa ao Better Auth quais nomes de modelo usar em vez dos padrões.
  user: {
    modelName: 'user',
  },
  session: {
    modelName: 'betterAuthSession',
  },
  account: {
    modelName: 'socialAccount',
  },
  verification: {
    modelName: 'betterAuthVerification',
  },

  // ─── Provider Google ──────────────────────────────────────────────────────
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  // ─── Origens confiáveis (CORS do Better Auth) ────────────────────────────
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://miucontrole.com.br',
    'https://www.miucontrole.com.br',
  ],
});
