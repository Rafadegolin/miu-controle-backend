import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, generateTestEmail } from './utils/test-utils';

describe('Accounts (e2e)', () => {
  let app: INestApplication<App>;
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
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // Create a test user and get auth token
    const email = generateTestEmail();
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'Test@123456',
        fullName: 'Test User',
      });

    accessToken = registerRes.body.accessToken;
    userId = registerRes.body.user.id;
  });

  describe('POST /accounts', () => {
    it('should create a new account', () => {
      return request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Conta Corrente',
          type: 'CHECKING',
          initialBalance: 1000,
          color: '#6366F1',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Conta Corrente');
          expect(res.body.type).toBe('CHECKING');
        });
    });

    it('should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .post('/accounts')
        .send({
          name: 'Test Account',
          type: 'CHECKING',
        })
        .expect(401);
    });

    it('should return 400 for invalid account type', () => {
      return request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Account',
          type: 'INVALID_TYPE',
        })
        .expect(400);
    });
  });

  describe('GET /accounts', () => {
    beforeEach(async () => {
      // Create test accounts
      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Conta 1',
          type: 'CHECKING',
          initialBalance: 1000,
        });

      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Conta 2',
          type: 'SAVINGS',
          initialBalance: 2000,
        });
    });

    it('should list all active accounts', () => {
      return request(app.getHttpServer())
        .get('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('should return 401 without auth token', () => {
      return request(app.getHttpServer()).get('/accounts').expect(401);
    });
  });

  describe('GET /accounts/balance', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Conta 1',
          type: 'CHECKING',
          initialBalance: 1000,
        });

      await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Conta 2',
          type: 'SAVINGS',
          initialBalance: 2000,
        });
    });

    it('should return total balance', () => {
      return request(app.getHttpServer())
        .get('/accounts/balance')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalBalance');
          expect(res.body).toHaveProperty('accounts');
          expect(Array.isArray(res.body.accounts)).toBe(true);
        });
    });
  });

  describe('PATCH /accounts/:id', () => {
    let accountId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Original Name',
          type: 'CHECKING',
          initialBalance: 1000,
        });

      accountId = createRes.body.id;
    });

    it('should update account information', () => {
      return request(app.getHttpServer())
        .patch(`/accounts/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Name',
          color: '#EF4444',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Name');
          expect(res.body.color).toBe('#EF4444');
        });
    });

    it('should return 404 for non-existent account', () => {
      return request(app.getHttpServer())
        .patch('/accounts/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'New Name' })
        .expect(404);
    });
  });

  describe('DELETE /accounts/:id', () => {
    let accountId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'To Delete',
          type: 'CHECKING',
        });

      accountId = createRes.body.id;
    });

    it('should soft delete account', async () => {
      await request(app.getHttpServer())
        .delete(`/accounts/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify account is inactive
      const account = await prisma.account.findUnique({
        where: { id: accountId },
      });

      expect(account?.isActive).toBe(false);
    });
  });
});
