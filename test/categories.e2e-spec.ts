import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, generateTestEmail } from './utils/test-utils';

describe('Categories (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;

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
  });

  describe('POST /categories', () => {
    it('should create a new category', () => {
      return request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Alimentação',
          type: 'EXPENSE',
          color: '#EF4444',
          icon: 'food',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Alimentação');
          expect(res.body.type).toBe('EXPENSE');
        });
    });

    it('should create subcategory', async () => {
      // Create parent category
      const parentRes = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Parent Category',
          type: 'EXPENSE',
        });

      const parentId = parentRes.body.id;

      // Create subcategory
      return request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Subcategory',
          type: 'EXPENSE',
          parentId,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.parentId).toBe(parentId);
        });
    });

    it('should return 400 for incompatible parent type', async () => {
      // Create INCOME parent
      const parentRes = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Income Parent',
          type: 'INCOME',
        });

      // Try to create EXPENSE child
      return request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Expense Child',
          type: 'EXPENSE',
          parentId: parentRes.body.id,
        })
        .expect(400);
    });
  });

  describe('GET /categories', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Category 1',
          type: 'EXPENSE',
        });

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Category 2',
          type: 'INCOME',
        });
    });

    it('should list all categories including system ones', () => {
      return request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // Should include user categories + system categories
          expect(res.body.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('should filter by type', () => {
      return request(app.getHttpServer())
        .get('/categories?type=EXPENSE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          const userCategories = res.body.filter(
            (c: any) => !c.isSystem && c.userId,
          );
          expect(userCategories.every((c: any) => c.type === 'EXPENSE')).toBe(
            true,
          );
        });
    });
  });

  describe('GET /categories/:id', () => {
    let categoryId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Category',
          type: 'EXPENSE',
        });

      categoryId = createRes.body.id;
    });

    it('should return category details', () => {
      return request(app.getHttpServer())
        .get(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('_count');
          expect(res.body._count).toHaveProperty('transactions');
        });
    });

    it('should return 404 for non-existent category', () => {
      return request(app.getHttpServer())
        .get('/categories/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /categories/:id', () => {
    let categoryId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Original Name',
          type: 'EXPENSE',
        });

      categoryId = createRes.body.id;
    });

    it('should update category', () => {
      return request(app.getHttpServer())
        .patch(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Name',
          color: '#10B981',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Name');
          expect(res.body.color).toBe('#10B981');
        });
    });
  });

  describe('DELETE /categories/:id', () => {
    let categoryId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'To Delete',
          type: 'EXPENSE',
        });

      categoryId = createRes.body.id;
    });

    it('should delete category without dependencies', () => {
      return request(app.getHttpServer())
        .delete(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('sucesso');
        });
    });

    it('should return 400 if category has transactions', async () => {
      // Create account first
      const accountRes = await request(app.getHttpServer())
        .post('/accounts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Account',
          type: 'CHECKING',
          initialBalance: 1000,
        });

      // Create transaction with this category
      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accountId: accountRes.body.id,
          categoryId,
          type: 'EXPENSE',
          amount: 50,
          description: 'Test',
        });

      // Try to delete category
      return request(app.getHttpServer())
        .delete(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 400 if category has children', async () => {
      // Create subcategory
      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Subcategory',
          type: 'EXPENSE',
          parentId: categoryId,
        });

      // Try to delete parent
      return request(app.getHttpServer())
        .delete(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('GET /categories/:id/stats', () => {
    let categoryId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Category',
          type: 'EXPENSE',
        });

      categoryId = createRes.body.id;
    });

    it('should return category statistics', () => {
      return request(app.getHttpServer())
        .get(`/categories/${categoryId}/stats`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('category');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('count');
          expect(res.body).toHaveProperty('average');
          expect(res.body).toHaveProperty('recentTransactions');
        });
    });
  });
});
