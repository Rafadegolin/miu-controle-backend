import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, generateTestEmail } from './utils/test-utils';

describe('Transactions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let accountId: string;
  let categoryId: string;

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
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // Create user and get auth token
    const email = generateTestEmail();
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'Test@123456',
        fullName: 'Test User',
      });

    accessToken = registerRes.body.accessToken;

    // Create a test account
    const accountRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Test Account',
        type: 'CHECKING',
        initialBalance: 1000,
      });

    accountId = accountRes.body.id;

    // Create a test category
    const categoryRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Test Category',
        type: 'EXPENSE',
      });

    categoryId = categoryRes.body.id;
  });

  describe('POST /transactions', () => {
    it('should create a new transaction', () => {
      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 50,
          description: 'Test Transaction',
          date: new Date().toISOString(),
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.amount).toBe(50);
          expect(res.body.type).toBe('EXPENSE');
        });
    });

    it('should return 401 without auth', () => {
      return request(app.getHttpServer())
        .post('/transactions')
        .send({
          accountId,
          type: 'EXPENSE',
          amount: 50,
          description: 'Test',
        })
        .expect(401);
    });

    it('should return 404 for invalid account', () => {
      return request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId: 'invalid',
          type: 'EXPENSE',
          amount: 50,
          description: 'Test',
        })
        .expect(404);
    });
  });

  describe('GET /transactions', () => {
    beforeEach(async () => {
      // Create test transactions
      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 100,
          description: 'Transaction 1',
        });

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId,
          categoryId,
          type: 'INCOME',
          amount: 500,
          description: 'Transaction 2',
        });
    });

    it('should list all transactions', () => {
      return request(app.getHttpServer())
        .get('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('should filter by type', () => {
      return request(app.getHttpServer())
        .get('/transactions?type=EXPENSE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.every((t: any) => t.type === 'EXPENSE')).toBe(true);
        });
    });
  });

  describe('GET /transactions/stats/monthly', () => {
    beforeEach(async () => {
      // Create transactions for current month
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId,
          categoryId,
          type: 'INCOME',
          amount: 2000,
          description: 'Salary',
          date: new Date().toISOString(),
        });

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 500,
          description: 'Expense',
          date: new Date().toISOString(),
        });
    });

    it('should return monthly statistics', () => {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      return request(app.getHttpServer())
        .get(`/transactions/stats/monthly?month=${month}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('income');
          expect(res.body).toHaveProperty('expenses');
          expect(res.body).toHaveProperty('balance');
          expect(res.body).toHaveProperty('categoryBreakdown');
        });
    });
  });

  describe('PATCH /transactions/:id', () => {
    let transactionId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 100,
          description: 'Original',
        });

      transactionId = createRes.body.id;
    });

    it('should update transaction', () => {
      return request(app.getHttpServer())
        .patch(`/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          description: 'Updated',
          amount: 150,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.description).toBe('Updated');
          expect(res.body.amount).toBe(150);
        });
    });
  });

  describe('DELETE /transactions/:id', () => {
    let transactionId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId,
          categoryId,
          type: 'EXPENSE',
          amount: 100,
          description: 'To Delete',
        });

      transactionId = createRes.body.id;
    });

    it('should delete transaction', () => {
      return request(app.getHttpServer())
        .delete(`/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('sucesso');
        });
    });
  });
});
