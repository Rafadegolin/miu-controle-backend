import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, generateTestEmail } from './utils/test-utils';

describe('Budgets (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
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

    // Create user
    const email = generateTestEmail();
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'Test@123456',
        fullName: 'Test User',
      });

    accessToken = registerRes.body.accessToken;

    // Create category
    const categoryRes = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Test Category',
        type: 'EXPENSE',
      });

    categoryId = categoryRes.body.id;
  });

  describe('POST /budgets', () => {
    it('should create a new budget', () => {
      return request(app.getHttpServer())
        .post('/budgets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          categoryId,
          amount: 1000,
          period: 'MONTHLY',
          startDate: '2025-01-01',
          alertPercentage: 80,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.amount).toBe(1000);
        });
    });

    it('should return 409 for duplicate budget', async () => {
      // Create first budget
      await request(app.getHttpServer())
        .post('/budgets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          categoryId,
          amount: 1000,
          period: 'MONTHLY',
          startDate: '2025-01-01',
        });

      // Try to create duplicate
      return request(app.getHttpServer())
        .post('/budgets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          categoryId,
          amount: 1500,
          period: 'MONTHLY',
          startDate: '2025-01-01',
        })
        .expect(409);
    });
  });

  describe('GET /budgets', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/budgets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          categoryId,
          amount: 1000,
          period: 'MONTHLY',
          startDate: '2025-01-01',
        });
    });

    it('should list all budgets', () => {
      return request(app.getHttpServer())
        .get('/budgets')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('spent');
          expect(res.body[0]).toHaveProperty('percentage');
          expect(res.body[0]).toHaveProperty('status');
        });
    });
  });

  describe('GET /budgets/:id', () => {
    let budgetId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/budgets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          categoryId,
          amount: 1000,
          period: 'MONTHLY',
          startDate: '2025-01-01',
        });

      budgetId = createRes.body.id;
    });

    it('should return budget details', () => {
      return request(app.getHttpServer())
        .get(`/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('transactions');
          expect(res.body).toHaveProperty('spent');
        });
    });
  });

  describe('PATCH /budgets/:id', () => {
    let budgetId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/budgets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          categoryId,
          amount: 1000,
          period: 'MONTHLY',
          startDate: '2025-01-01',
        });

      budgetId = createRes.body.id;
    });

    it('should update budget', () => {
      return request(app.getHttpServer())
        .patch(`/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 1500,
          alertPercentage: 90,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.amount).toBe(1500);
        });
    });
  });

  describe('DELETE /budgets/:id', () => {
    let budgetId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/budgets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          categoryId,
          amount: 1000,
          period: 'MONTHLY',
          startDate: '2025-01-01',
        });

      budgetId = createRes.body.id;
    });

    it('should delete budget', () => {
      return request(app.getHttpServer())
        .delete(`/budgets/${budgetId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('sucesso');
        });
    });
  });

  describe('GET /budgets/summary', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/budgets')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          categoryId,
          amount: 1000,
          period: 'MONTHLY',
          startDate: new Date().toISOString().slice(0, 10),
        });
    });

    it('should return budget summary', () => {
      return request(app.getHttpServer())
        .get('/budgets/summary')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalBudgeted');
          expect(res.body).toHaveProperty('totalSpent');
          expect(res.body).toHaveProperty('budgets');
        });
    });
  });
});
