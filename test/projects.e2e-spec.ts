import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, generateTestEmail } from './utils/test-utils';

describe('Projects (e2e)', () => {
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

    const email = generateTestEmail();
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'Test@123456', fullName: 'Test User' });

    accessToken = registerRes.body.accessToken;

    const accountRes = await request(app.getHttpServer())
      .post('/accounts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Conta Teste', type: 'CHECKING', initialBalance: 5000 });

    accountId = accountRes.body.id;
  });

  // ═══ POST /projects ══════════════════════════════════════════════════════════

  describe('POST /projects', () => {
    it('deve criar projeto com campos básicos', async () => {
      const res = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Arrumar Carro', totalBudget: 1000 })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Arrumar Carro',
        status: 'PLANNING',
      });
      expect(res.body).toHaveProperty('id');
    });

    it('deve retornar 401 sem token', () => {
      return request(app.getHttpServer())
        .post('/projects')
        .send({ name: 'Proj' })
        .expect(401);
    });

    it('deve retornar 400 com nome muito curto', () => {
      return request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'X' })
        .expect(400);
    });
  });

  // ═══ GET /projects ═══════════════════════════════════════════════════════════

  describe('GET /projects', () => {
    it('deve listar projetos do usuário', async () => {
      await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Projeto A' });

      await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Projeto B' });

      const res = await request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
    });

    it('deve filtrar por status', async () => {
      await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Planejando' });

      const res = await request(app.getHttpServer())
        .get('/projects?status=PLANNING')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.every((p) => p.status === 'PLANNING')).toBe(true);
    });
  });

  // ═══ Fluxo completo: Projeto → Item → Cotação → Selecionar → Converter ══════

  describe('Fluxo completo de projeto', () => {
    let projectId: string;
    let itemId: string;
    let quoteId: string;
    let quoteId2: string;

    beforeEach(async () => {
      // 1. Criar projeto
      const projRes = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Arrumar Carro',
          totalBudget: 1500,
          deadline: '2026-12-31',
        })
        .expect(201);
      projectId = projRes.body.id;

      // 2. Adicionar item
      const itemRes = await request(app.getHttpServer())
        .post(`/projects/${projectId}/items`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Bateria nova', priority: 1 })
        .expect(201);
      itemId = itemRes.body.id;

      // 3. Adicionar cotações
      const q1 = await request(app.getHttpServer())
        .post(`/projects/${projectId}/items/${itemId}/quotes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ supplierName: 'AutoPeças', price: 450 })
        .expect(201);
      quoteId = q1.body.id;

      const q2 = await request(app.getHttpServer())
        .post(`/projects/${projectId}/items/${itemId}/quotes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ supplierName: 'MercadoLivre', price: 420, additionalCosts: 30 })
        .expect(201);
      quoteId2 = q2.body.id;
    });

    it('item deve estar QUOTED após adicionar cotação', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const item = res.body.items.find((i) => i.id === itemId);
      expect(item.status).toBe('QUOTED');
      expect(item.quotes).toHaveLength(2);
    });

    it('deve selecionar cotação e desmarcar as demais', async () => {
      // Selecionar cotação 1
      await request(app.getHttpServer())
        .patch(
          `/projects/${projectId}/items/${itemId}/quotes/${quoteId}/select`,
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Selecionar cotação 2 (deve desmarcar a 1)
      const res = await request(app.getHttpServer())
        .patch(
          `/projects/${projectId}/items/${itemId}/quotes/${quoteId2}/select`,
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.status).toBe('SELECTED');

      // Verificar que cotação 1 voltou para PENDING
      const projRes = await request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      const item = projRes.body.items.find((i) => i.id === itemId);
      const q1 = item.quotes.find((q) => q.id === quoteId);
      expect(q1.status).toBe('PENDING');
    });

    it('deve converter cotação selecionada em transação e debitar saldo', async () => {
      // Selecionar cotação 1 (R$ 450)
      await request(app.getHttpServer())
        .patch(
          `/projects/${projectId}/items/${itemId}/quotes/${quoteId}/select`,
        )
        .set('Authorization', `Bearer ${accessToken}`);

      // Converter
      const convertRes = await request(app.getHttpServer())
        .post(`/projects/${projectId}/items/${itemId}/convert`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ accountId })
        .expect(201);

      expect(convertRes.body).toHaveProperty('transaction');
      expect(convertRes.body.transaction.type).toBe('EXPENSE');
      expect(Number(convertRes.body.transaction.amount)).toBe(450);
      expect(convertRes.body.item.status).toBe('PURCHASED');
      expect(convertRes.body.totalConverted).toBe(450);

      // Saldo da conta deve ter sido debitado
      const accountRes = await request(app.getHttpServer())
        .get(`/accounts/${accountId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(Number(accountRes.body.currentBalance)).toBe(4550); // 5000 - 450
    });

    it('deve marcar projeto como COMPLETED após todos os itens comprados', async () => {
      await request(app.getHttpServer())
        .patch(
          `/projects/${projectId}/items/${itemId}/quotes/${quoteId}/select`,
        )
        .set('Authorization', `Bearer ${accessToken}`);

      const convertRes = await request(app.getHttpServer())
        .post(`/projects/${projectId}/items/${itemId}/convert`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ accountId });

      expect(convertRes.body.projectStatus).toBe('COMPLETED');
    });

    it('deve retornar 409 ao tentar converter item já comprado', async () => {
      // Primeira conversão
      await request(app.getHttpServer())
        .patch(
          `/projects/${projectId}/items/${itemId}/quotes/${quoteId}/select`,
        )
        .set('Authorization', `Bearer ${accessToken}`);

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/items/${itemId}/convert`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ accountId });

      // Segunda tentativa → deve falhar
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/items/${itemId}/convert`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ accountId })
        .expect(409);
    });

    it('deve retornar 422 ao converter sem cotação selecionada', () => {
      return request(app.getHttpServer())
        .post(`/projects/${projectId}/items/${itemId}/convert`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ accountId })
        .expect(422);
    });
  });

  // ═══ GET /projects/:id/summary ═══════════════════════════════════════════════

  describe('GET /projects/:id/summary', () => {
    it('deve retornar resumo com estatísticas corretas', async () => {
      // Criar projeto com 1 item e 1 cotação convertida
      const projRes = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Test Summary', totalBudget: 1000 })
        .expect(201);
      const pid = projRes.body.id;

      const itemRes = await request(app.getHttpServer())
        .post(`/projects/${pid}/items`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Item A' });
      const iid = itemRes.body.id;

      const qRes = await request(app.getHttpServer())
        .post(`/projects/${pid}/items/${iid}/quotes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ supplierName: 'Loja X', price: 300 });
      const qid = qRes.body.id;

      await request(app.getHttpServer())
        .patch(`/projects/${pid}/items/${iid}/quotes/${qid}/select`)
        .set('Authorization', `Bearer ${accessToken}`);

      await request(app.getHttpServer())
        .post(`/projects/${pid}/items/${iid}/convert`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ accountId });

      const summaryRes = await request(app.getHttpServer())
        .get(`/projects/${pid}/summary`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(summaryRes.body.stats.progressPercent).toBe(100);
      expect(summaryRes.body.stats.totalSpent).toBe(300);
      expect(summaryRes.body.stats.budgetVariance).toBe(700); // 1000 - 300
    });
  });

  // ═══ Isolamento entre usuários ════════════════════════════════════════════════

  describe('Isolamento entre usuários', () => {
    it('não deve permitir acesso a projeto de outro usuário', async () => {
      // Criar projeto com user1
      const projRes = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Meu Projeto' })
        .expect(201);
      const pid = projRes.body.id;

      // Registrar user2
      const email2 = generateTestEmail();
      const res2 = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: email2, password: 'Test@123456', fullName: 'User 2' });
      const token2 = res2.body.accessToken;

      // User2 tenta acessar projeto do user1
      await request(app.getHttpServer())
        .get(`/projects/${pid}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(404);
    });
  });
});
