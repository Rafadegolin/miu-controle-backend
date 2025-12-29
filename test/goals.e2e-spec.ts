import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, generateTestEmail } from './utils/test-utils';

describe('Goals (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let accountId: string;

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

    // Create account for contributions
    const accountRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Test Account',
        type: 'CHECKING',
        initialBalance: 10000,
      });

    accountId = accountRes.body.id;
  });

  describe('POST /goals', () => {
    it('should create a new goal', () => {
      return request(app.getHttpServer())
        .post('/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Comprar Carro',
          description: 'Economizar para carro novo',
          targetAmount: 50000,
          targetDate: '2026-12-31',
          priority: 1,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Comprar Carro');
          expect(res.body.targetAmount).toBe(50000);
        });
    });

    it('should return 400 for past target date', () => {
      return request(app.getHttpServer())
        .post('/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Goal',
          targetAmount: 1000,
          targetDate: '2020-01-01',
        })
        .expect(400);
    });
  });

  describe('GET /goals', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Goal 1',
          targetAmount: 5000,
        });

      await request(app.getHttpServer())
        .post('/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Goal 2',
          targetAmount: 10000,
        });
    });

    it('should list all goals', () => {
      return request(app.getHttpServer())
        .get('/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(2);
          expect(res.body[0]).toHaveProperty('percentage');
          expect(res.body[0]).toHaveProperty('remaining');
        });
    });

    it('should filter by status', () => {
      return request(app.getHttpServer())
        .get('/goals?status=ACTIVE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.every((g: any) => g.status === 'ACTIVE')).toBe(true);
        });
    });
  });

  describe('GET /goals/:id', () => {
    let goalId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Goal',
          targetAmount: 5000,
        });

      goalId = createRes.body.id;
    });

    it('should return goal details with contributions', () => {
      return request(app.getHttpServer())
        .get(`/goals/${goalId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('contributions');
          expect(res.body).toHaveProperty('percentage');
        });
    });
  });

  describe('POST /goals/:id/contribute', () => {
    let goalId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Goal',
          targetAmount: 5000,
        });

      goalId = createRes.body.id;
    });

    it('should add contribution to goal', () => {
      return request(app.getHttpServer())
        .post(`/goals/${goalId}/contribute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 1000,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('contribution');
          expect(res.body).toHaveProperty('goal');
          expect(res.body.contribution.amount).toBe(1000);
        });
    });

    it('should mark goal as COMPLETED when target is reached', async () => {
      // First contribution
      await request(app.getHttpServer())
        .post(`/goals/${goalId}/contribute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 5000,
        });

      // Check if goal is completed
      return request(app.getHttpServer())
        .get(`/goals/${goalId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('COMPLETED');
          expect(res.body.currentAmount).toBeGreaterThanOrEqual(5000);
        });
    });
  });

  describe('POST /goals/:id/withdraw', () => {
    let goalId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Goal',
          targetAmount: 5000,
        });

      goalId = createRes.body.id;

      // Add initial contribution
      await request(app.getHttpServer())
        .post(`/goals/${goalId}/contribute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 2000,
        });
    });

    it('should withdraw from goal', () => {
      return request(app.getHttpServer())
        .post(`/goals/${goalId}/withdraw`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 500,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.contribution.amount).toBe(-500);
          expect(res.body.goal.currentAmount).toBe(1500);
        });
    });

    it('should return 400 if withdrawal exceeds current amount', () => {
      return request(app.getHttpServer())
        .post(`/goals/${goalId}/withdraw`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 5000,
        })
        .expect(400);
    });
  });

  describe('PATCH /goals/:id', () => {
    let goalId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Original Goal',
          targetAmount: 5000,
        });

      goalId = createRes.body.id;
    });

    it('should update goal', () => {
      return request(app.getHttpServer())
        .patch(`/goals/${goalId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Goal',
          targetAmount: 7000,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Goal');
          expect(res.body.targetAmount).toBe(7000);
        });
    });
  });

  describe('DELETE /goals/:id', () => {
    let goalId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'To Delete',
          targetAmount: 1000,
        });

      goalId = createRes.body.id;
    });

    it('should delete goal without contributions', () => {
      return request(app.getHttpServer())
        .delete(`/goals/${goalId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('sucesso');
        });
    });

    it('should return 400 if goal has contributions', async () => {
      // Add contribution
      await request(app.getHttpServer())
        .post(`/goals/${goalId}/contribute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 100,
        });

      return request(app.getHttpServer())
        .delete(`/goals/${goalId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('GET /goals/summary', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Goal 1',
          targetAmount: 5000,
        });

      await request(app.getHttpServer())
        .post('/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Goal 2',
          targetAmount: 10000,
        });
    });

    it('should return goals summary', () => {
      return request(app.getHttpServer())
        .get('/goals/summary')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('active');
          expect(res.body).toHaveProperty('totalTargeted');
          expect(res.body).toHaveProperty('totalSaved');
          expect(res.body).toHaveProperty('goals');
        });
    });
  });
});
