import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, generateTestEmail } from './utils/test-utils';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', () => {
      const email = generateTestEmail();

      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'Test@123456',
          fullName: 'Test User',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body.user.email).toBe(email);
        });
    });

    it('should return 409 if email already exists', async () => {
      const email = generateTestEmail();

      // Register first user
      await request(app.getHttpServer()).post('/auth/register').send({
        email,
        password: 'Test@123456',
        fullName: 'First User',
      });

      // Try to register with same email
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'Different@123',
          fullName: 'Second User',
        })
        .expect(409);
    });

    it('should return 400 for invalid email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Test@123456',
          fullName: 'Test User',
        })
        .expect(400);
    });

    it('should return 400 for weak password', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: generateTestEmail(),
          password: '123',
          fullName: 'Test User',
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    let testEmail: string;
    const testPassword = 'Test@123456';

    beforeEach(async () => {
      testEmail = generateTestEmail();
      await request(app.getHttpServer()).post('/auth/register').send({
        email: testEmail,
        password: testPassword,
        fullName: 'Test User',
      });
    });

    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
        });
    });

    it('should return 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword@123',
        })
        .expect(401);
    });

    it('should return 401 for non-existent user', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: generateTestEmail(),
          password: testPassword,
        })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const email = generateTestEmail();

      // Register and login
      const loginRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'Test@123456',
          fullName: 'Test User',
        });

      const refreshToken = loginRes.body.refreshToken;

      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
        });
    });

    it('should return 401 for invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });
});
