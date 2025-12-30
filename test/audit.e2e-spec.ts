import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditAction } from '../src/common/enums/audit-action.enum';
import { AuditEntity } from '../src/common/enums/audit-entity.enum';

describe('Audit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Criar usuário de teste e fazer login
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `audit-test-${Date.now()}@example.com`,
        password: 'Test@12345',
        fullName: 'Audit Test User',
      });

    accessToken = registerResponse.body.accessToken;
    userId = registerResponse.body.user.id;
  });

  afterAll(async () => {
    // Limpar dados de teste
    if (userId) {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await app.close();
  });

  describe('/audit/me (GET)', () => {
    it('deve retornar logs do usuário autenticado', async () => {
      // Criar um log de auditoria manual para teste
      await prisma.auditLog.create({
        data: {
          userId,
          action: AuditAction.CREATE,
          entity: AuditEntity.TRANSACTION,
          entityId: 'test-transaction-123',
          after: { amount: 100, description: 'Test transaction' },
          ipAddress: '192.168.1.1',
          userAgent: 'Test Agent',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/audit/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('hasMore');
      expect(response.body).toHaveProperty('nextCursor');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);

      // Verificar estrutura do log
      const log = response.body.items[0];
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('action');
      expect(log).toHaveProperty('entity');
      expect(log).toHaveProperty('createdAt');
    });

    it('deve filtrar por ação', async () => {
      const response = await request(app.getHttpServer())
        .get('/audit/me')
        .query({ action: AuditAction.CREATE })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.items.every((log) => log.action === AuditAction.CREATE)).toBe(true);
    });

    it('deve filtrar por entidade', async () => {
      const response = await request(app.getHttpServer())
        .get('/audit/me')
        .query({ entity: AuditEntity.TRANSACTION })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(
        response.body.items.every((log) => log.entity === AuditEntity.TRANSACTION),
      ).toBe(true);
    });

    it('deve filtrar por data', async () => {
      const startDate = new Date('2025-01-01').toISOString();
      const endDate = new Date('2025-12-31').toISOString();

      const response = await request(app.getHttpServer())
        .get('/audit/me')
        .query({ startDate, endDate })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
    });

    it('deve retornar 401 se não autenticado', async () => {
      await request(app.getHttpServer()).get('/audit/me').expect(401);
    });

    it('deve respeitar limite de paginação', async () => {
      const response = await request(app.getHttpServer())
        .get('/audit/me')
        .query({ take: 5 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.items.length).toBeLessThanOrEqual(5);
    });
  });

  describe('/audit/entity/:entity/:entityId (GET)', () => {
    let testEntityId: string;

    beforeAll(async () => {
      // Criar uma entidade e log de teste
      testEntityId = 'test-entity-' + Date.now();
      await prisma.auditLog.create({
        data: {
          userId,
          action: AuditAction.CREATE,
          entity: AuditEntity.TRANSACTION,
          entityId: testEntityId,
          after: { amount: 200 },
        },
      });
    });

    it('deve retornar histórico de uma entidade', async () => {
      const response = await request(app.getHttpServer())
        .get(`/audit/entity/${AuditEntity.TRANSACTION}/${testEntityId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items[0]).toHaveProperty('user');
      expect(response.body.items[0].entityId).toBe(testEntityId);
    });

    it('deve retornar 401 se não autenticado', async () => {
      await request(app.getHttpServer())
        .get(`/audit/entity/${AuditEntity.TRANSACTION}/${testEntityId}`)
        .expect(401);
    });
  });

  describe('Auditoria automática via interceptor', () => {
    let accountId: string;

    beforeAll(async () => {
      // Criar uma conta para testes
      const accountResponse = await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Account for Audit',
          type: 'CHECKING',
          initialBalance: 1000,
        });

      accountId = accountResponse.body.id;
    });

    it('deve criar log de auditoria ao criar transação', async () => {
      const transactionResponse = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId,
          type: 'EXPENSE',
          amount: 50,
          description: 'Test for audit',
          date: new Date().toISOString(),
        });

      const transactionId = transactionResponse.body.id;

      // Aguardar o log assíncrono ser criado
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verificar se o log foi criado
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          userId,
          entity: AuditEntity.TRANSACTION,
          entityId: transactionId,
          action: AuditAction.CREATE,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].after).toBeTruthy();
      expect(auditLogs[0].before).toBeFalsy();
    });

    it('deve criar log com before/after ao atualizar transação', async () => {
      // Criar transação
      const createResponse = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId,
          type: 'EXPENSE',
          amount: 100,
          description: 'Original description',
          date: new Date().toISOString(),
        });

      const transactionId = createResponse.body.id;

      // Aguardar criação do log
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Atualizar transação
      await request(app.getHttpServer())
        .patch(`/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 150,
          description: 'Updated description',
        });

      // Aguardar criação do log de update
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verificar se o log de UPDATE foi criado
      const updateLogs = await prisma.auditLog.findMany({
        where: {
          userId,
          entity: AuditEntity.TRANSACTION,
          entityId: transactionId,
          action: AuditAction.UPDATE,
        },
      });

      expect(updateLogs.length).toBeGreaterThan(0);
      expect(updateLogs[0].before).toBeTruthy();
      expect(updateLogs[0].after).toBeTruthy();
      expect((updateLogs[0].before as any).amount).toBe('100');
      expect((updateLogs[0].after as any).amount).toBe('150');
    });

    it('deve criar log com before ao deletar transação', async () => {
      // Criar transação
      const createResponse = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId,
          type: 'EXPENSE',
          amount: 75,
          description: 'To be deleted',
          date: new Date().toISOString(),
        });

      const transactionId = createResponse.body.id;

      // Aguardar criação do log
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Deletar transação
      await request(app.getHttpServer())
        .delete(`/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      // Aguardar criação do log de delete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verificar se o log de DELETE foi criado
      const deleteLogs = await prisma.auditLog.findMany({
        where: {
          userId,
          entity: AuditEntity.TRANSACTION,
          entityId: transactionId,
          action: AuditAction.DELETE,
        },
      });

      expect(deleteLogs.length).toBeGreaterThan(0);
      expect(deleteLogs[0].before).toBeTruthy();
      expect(deleteLogs[0].after).toBeFalsy();
      expect((deleteLogs[0].before as any).amount).toBe('75');
    });
  });
});
