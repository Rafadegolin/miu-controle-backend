import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Cria app NestJS configurado para testes E2E
 */
export async function createTestApp(
  moduleImports: any[],
): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: moduleImports,
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Aplicar mesmas configurações do main.ts
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return app;
}

/**
 * Limpa database de teste
 */
export async function cleanDatabase(prisma: PrismaService) {
  // Ordem importa devido a foreign keys
  await prisma.notification.deleteMany();
  // Projects (Issue #79) — deve vir antes de transactions para evitar FK
  await prisma.quote.deleteMany();
  await prisma.projectItem.deleteMany();
  await prisma.project.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.recurringTransaction.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.goalContribution.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.account.deleteMany();
  await prisma.category.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Gera email único para testes
 */
export function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
}
