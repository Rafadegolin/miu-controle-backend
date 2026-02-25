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

import { PrismaClient } from '@prisma/client';

// Instância dedicada do Prisma para o Better Auth.
// Não usamos o PrismaService do NestJS aqui porque o Better Auth
// precisa de uma instância disponível antes do bootstrap do NestJS.
const prisma = new PrismaClient();

// Singleton lazy: better-auth é ESM-only, então usamos dynamic import()
// para que o Node não tente carregar .mjs via require() (ERR_REQUIRE_ESM).
let _auth: any = null;
let _initPromise: Promise<any> | null = null;

// esmImport impede que o TypeScript transforme import() em require(),
// o que causaria ERR_REQUIRE_ESM ao tentar carregar better-auth (ESM-only).
const esmImport = new Function('s', 'return import(s)') as (
  s: string,
) => Promise<any>;

export function getAuth(): Promise<any> {
  if (_auth) return Promise.resolve(_auth);
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const { betterAuth } = await esmImport('better-auth');
    const { prismaAdapter } = await esmImport('better-auth/adapters/prisma');

    _auth = betterAuth({
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

    return _auth;
  })();

  return _initPromise;
}

// Re-exporta um proxy para manter compatibilidade com imports existentes.
// O objeto real estará disponível após a primeira chamada a getAuth().
export const auth = new Proxy({} as any, {
  get(_target, prop) {
    if (_auth) return _auth[prop];
    throw new Error(
      `[BetterAuth] Acesse 'auth' apenas após aguardar getAuth(). Propriedade acessada: ${String(prop)}`,
    );
  },
});
