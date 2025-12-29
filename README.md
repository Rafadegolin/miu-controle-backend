# 💰 Miu Controle - Backend

<div align="center">

![Miu Controle](https://img.shields.io/badge/Miu%20Controle-Backend-6366F1?style=for-the-badge)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

**API REST completa para controle financeiro pessoal com autenticação JWT, analytics avançado e sistema de categorização inteligente.**

[🚀 Demo](#-instalação-e-setup) · [📚 Documentação](#-documentação-da-api) · [🐛 Reportar Bug](https://github.com/Rafadegolin/miu-controle-backend/issues) · [✨ Solicitar Feature](https://github.com/Rafadegolin/miu-controle-backend/issues)

</div>

---

## 🎯 Sobre o Miu Controle

O **Miu Controle** é uma aplicação de finanças pessoais focada em **facilitar o registro de despesas** através de automação e UX otimizada.

### 💡 O Problema

A maioria das pessoas desiste de controlar suas finanças porque registrar cada gasto é **lento e chato**. Abrir uma planilha, anotar, categorizar... tudo isso toma tempo e cria fricção.

### ✨ A Solução

**Registre uma despesa em menos de 5 segundos.** Através de automação (notificações bancárias), analytics visuais e interface otimizada, o Miu Controle torna o controle financeiro algo natural, não uma tarefa.

---

## 🚀 Features

### ✅ Implementadas

- 🔐 **Autenticação JWT** com refresh tokens e proteção de rotas
- 🏦 **Gerenciamento de Contas** (bancárias, cartões, investimentos)
- 💸 **Transações Completas** (despesas, receitas, transferências)
- 🎨 **19 Categorias Padrão** pré-configuradas com cores e ícones
- 📊 **Analytics Avançado** (estatísticas mensais, breakdown por categoria)
- ✅ **Validações Robustas** com class-validator
- 📖 **Documentação Swagger** automática e interativa
- ⚡ **Atualização automática de saldo** ao criar/editar/deletar transações
- 🐳 **Docker Multi-stage** para deploy otimizado (<300MB)
- 🤖 **CI/CD Automático** via GitHub Actions

### 🔜 Roadmap

- [ ] **Cache com Redis** - Performance e rate limiting
- [ ] **Orçamentos** - Definir limites mensais por categoria
- [ ] **Objetivos (Potes Virtuais)** - Guardar dinheiro para metas específicas
- [ ] **Categorização Automática** - IA aprende seus padrões de gasto
- [ ] **Notificações Bancárias** - Registro automático via SMS (Android)
- [ ] **Open Banking** - Integração com Pluggy/Belvo
- [ ] **SaaS/Assinaturas** - AbacatePay para planos Pro e Family

---

## 🛠️ Stack Tecnológica

| Tecnologia          | Versão | Descrição                     |
| ------------------- | ------ | ----------------------------- |
| **NestJS**          | 11.x   | Framework Node.js progressivo |
| **Prisma**          | 5.x    | ORM TypeScript-first          |
| **PostgreSQL**      | 15+    | Banco relacional              |
| **TypeScript**      | 5.x    | Linguagem tipada              |
| **JWT**             | -      | Autenticação stateless        |
| **class-validator** | -      | Validação de DTOs             |
| **Swagger**         | -      | Documentação OpenAPI          |
| **Docker**          | -      | Containerização               |

---

## 📋 Pré-requisitos

Antes de começar, você precisará ter instalado:

- [Node.js](https://nodejs.org/) 18 ou superior
- [PostgreSQL](https://www.postgresql.org/download/) 15 ou superior
- npm ou yarn
- (Opcional) [Docker](https://www.docker.com/) para deploy

---

## 🚀 Instalação e Setup

### 1. Clone o repositório

git clone https://github.com/Rafadegolin/miu-controle-backend.git
cd miu-controle-backend


### 2. Instale as dependências

npm install


### 3. Configure as variáveis de ambiente

Copie o arquivo de exemplo:

cp .env.example .env


Edite o `.env` com suas configurações:

Database
DATABASE_URL="postgresql://usuario:senha@localhost:5432/miu_controle?schema=public"

Redis (quando implementar cache)
REDIS_HOST=localhost
REDIS_PORT=6379

JWT Secrets (MUDE ISSO EM PRODUÇÃO!)
JWT_SECRET="seu_jwt_secret_super_seguro_MUDE_ISSO"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_SECRET="seu_refresh_secret_diferente_MUDE_ISSO"
REFRESH_TOKEN_EXPIRES_IN="7d"

API
PORT=3001
NODE_ENV=development

Frontend (CORS)
FRONTEND_URL="http://localhost:3000"

MinIO/S3 (Upload de avatares)
MINIO_ENDPOINT=seu-vps-ip-ou-dominio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=sua_access_key
MINIO_SECRET_KEY=sua_secret_key
MINIO_BUCKET_NAME=avatar-user
MINIO_PUBLIC_URL=http://seu-vps-ip-ou-dominio:9000

Email (Resend)
EMAIL_FROM="Miu Controle noreply@seudominio.com"
RESEND_API_KEY=re_exemplo_chave_resend_aqui


### 4. Execute as migrations do Prisma

npx prisma migrate dev


### 5. Popule as categorias padrão

npx prisma db seed


Isso criará 19 categorias com cores e ícones:
- 🍽️ Alimentação, 🚗 Transporte, 🏠 Moradia, 🏥 Saúde, etc.

### 6. Inicie o servidor

Desenvolvimento (hot-reload)
npm run start:dev

Produção
npm run build
npm run start:prod


✅ A API estará rodando em `http://localhost:3001`

---

## 🔒 Segurança

### Headers de Segurança Implementados

A API implementa os seguintes headers de proteção (via Helmet):

| Header | Valor | Proteção |
|--------|-------|----------|
| `X-Frame-Options` | `SAMEORIGIN` | Previne clickjacking (iframe malicioso) |
| `X-Content-Type-Options` | `nosniff` | Previne MIME type sniffing |
| `Referrer-Policy` | `no-referrer` | Não vaza URLs sensíveis |
| `X-DNS-Prefetch-Control` | `off` | Reduz vazamento de DNS |
| `X-Response-Time` | `123ms` | Tempo de processamento (debug) |

### CORS (Cross-Origin Resource Sharing)

Apenas os seguintes domínios podem acessar a API:

- `http://localhost:3000` (desenvolvimento)
- `https://miucontrole.com.br` (produção)
- `https://www.miucontrole.com.br` (produção)
- `https://*.vercel.app` (deploys de preview)

**Testar CORS:**
```bash
# ✅ Permitido
curl -H "Origin: http://localhost:3000" http://localhost:3001/health

# 🚫 Bloqueado (verá warning no console do servidor)
curl -H "Origin: http://evil.com" http://localhost:3001/health
```

### Sanitização de Inputs

Todos os campos de texto livre são automaticamente sanitizados para prevenir ataques XSS:
- Remove tags HTML (`<script>`, `<iframe>`, etc.)
- Remove event handlers (`onclick`, `onerror`)
- Remove protocolos perigosos (`javascript:`)

**Exemplo:**
```bash
# Input:  "<script>alert('XSS')</script>Almoço"
# Output: "Almoço"
```

### Timeout Global

Requisições que excedem **30 segundos** são automaticamente canceladas (previne DoS).

Configurável via variável de ambiente `REQUEST_TIMEOUT_MS` (padrão: 30000ms).

---

## 🚦 Rate Limiting

A API implementa proteção contra abuso com limites configurados por endpoint usando `@nestjs/throttler`.

### Limites Globais

Por padrão, todos os endpoints respeitam os seguintes limites cumulativos:

- **Short**: 10 requisições por segundo
- **Medium**: 100 requisições por minuto  
- **Long**: 500 requisições por 15 minutos

### Limites por Endpoint

Endpoints críticos possuem limites customizados mais rigorosos:

| Endpoint | Limite | Motivo |
|----------|--------|--------|
| `POST /auth/login` | 5 req/min | Previne brute force |
| `POST /auth/register` | 3 req/hora | Previne spam de contas |
| `POST /auth/forgot-password` | 3 req/hora | Previne spam de emails |
| `POST /auth/resend-verification` | 3 req/hora | Previne spam de emails |
| `POST /transactions` | 60 req/min | Previne criação em massa |
| `GET /export/csv` | 10 req/hora | Operação custosa |
| `GET /export/excel` | 10 req/hora | Operação custosa |
| `GET /export/pdf` | 10 req/hora | Operação custosa |
| `GET /health` | Sem limite | Monitoramento |
| `POST /auth/verify-email` | Sem limite | Validação por token único |

### Headers de Rate Limit

Todas as requisições incluem headers informativos:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Resposta 429 (Too Many Requests)

Quando o limite é excedido:

```json
{
  "statusCode": 429,
  "message": "Limite de requisições excedido. Tente novamente mais tarde.",
  "error": "Too Many Requests",
  "retryAfter": "60s"
}
```

O header `Retry-After` indica (em segundos) quando você pode tentar novamente.

**Exemplo:**
```bash
curl -I http://localhost:3001/auth/login
# Retry-After: 60
```

---

## 🏥 Healthcheck e Monitoring

A API implementa healthchecks robustos usando `@nestjs/terminus` para monitoramento e orquestração (Kubernetes).

### Endpoints de Health

| Endpoint | Descrição | Uso |
|----------|-----------|-----|
| `GET /health` | Health check completo | Monitoramento geral |
| `GET /health/live` | Liveness probe | Kubernetes (restart se falhar) |
| `GET /health/ready` | Readiness probe | Kubernetes (parar tráfego se falhar) |
| `GET /health/metrics` | Métricas da aplicação | Observabilidade |

### Health Checks Implementados

**GET /health** verifica:
- ✅ **Database**: Conexão com PostgreSQL (Prisma)
- ✅ **Memory**: Uso de heap (máx 512MB)
- ✅ **Disk**: Espaço em disco (mín 10% livre)

**Resposta de exemplo:**
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up" },
    "storage": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up" },
    "storage": { "status": "up" }
  }
}
```

### Kubernetes Configuration

**Liveness Probe** (verifica se pod está vivo):
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10
```

**Readiness Probe** (verifica se pod está pronto):
```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 5
```

### Métricas

**GET /health/metrics** retorna:
```json
{
  "application": {
    "name": "Miu Controle API",
    "version": "1.0.0",
    "uptime": 12345,
    "environment": "production"
  },
  "database": {
    "totalUsers": 150,
    "totalTransactions": 5420,
    "todayTransactions": 25
  },
  "performance": {
    "totalRequests": 10523,
    "averageLatency": 45,
    "memoryUsage": {
      "rss": 50331648,
      "heapTotal": 20971520,
      "heapUsed": 15728640
    }
  },
  "timestamp": "2025-12-28T23:30:00.000Z"
}
```

---

## 📚 Documentação da API

### Swagger UI (Interativo)

Após iniciar o servidor, acesse:

👉 [[**http://localhost:3001/api**](http://localhost:3001/api)](http://localhost:3001/api)

![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=flat&logo=swagger&logoColor=black)

### Endpoints Principais

#### 🔐 Autenticação

| Método | Endpoint         | Descrição                    |
| ------ | ---------------- | ---------------------------- |
| `POST` | `/auth/register` | Criar nova conta             |
| `POST` | `/auth/login`    | Fazer login (retorna JWT)    |
| `GET`  | `/auth/me`       | Dados do usuário autenticado |

#### 🏦 Contas

| Método   | Endpoint            | Descrição               |
| -------- | ------------------- | ----------------------- |
| `POST`   | `/accounts`         | Criar conta bancária    |
| `GET`    | `/accounts`         | Listar todas as contas  |
| `GET`    | `/accounts/balance` | Saldo total consolidado |
| `GET`    | `/accounts/:id`     | Buscar conta específica |
| `PATCH`  | `/accounts/:id`     | Atualizar conta         |
| `DELETE` | `/accounts/:id`     | Desativar conta         |

#### 💸 Transações

| Método   | Endpoint                           | Descrição            |
| -------- | ---------------------------------- | -------------------- |
| `POST`   | `/transactions`                    | Criar transação      |
| `GET`    | `/transactions`                    | Listar com filtros   |
| `GET`    | `/transactions/stats/monthly`      | Estatísticas mensais |
| `GET`    | `/transactions/stats/category/:id` | Stats por categoria  |
| `GET`    | `/transactions/:id`                | Buscar transação     |
| `PATCH`  | `/transactions/:id`                | Atualizar transação  |
| `DELETE` | `/transactions/:id`                | Deletar transação    |

### Exemplo de Requisição

**1. Fazer login**
curl -X POST http://localhost:3001/auth/login
-H "Content-Type: application/json"
-d '{"email":"seu@email.com","password":"SuaSenha@123"}'


**2. Criar transação (com token)**
curl -X POST http://localhost:3001/transactions
-H "Content-Type: application/json"
-H "Authorization: Bearer SEU_TOKEN_AQUI"
-d '{
"accountId": "uuid-da-conta",
"categoryId": "cat-alimentacao",
"type": "EXPENSE",
"amount": 45.90,
"description": "Almoço"
}'


---

## 🗄️ Estrutura do Banco de Dados

users (Usuários)
├── accounts (1:N) # Contas bancárias
│ └── transactions (1:N) # Transações da conta
├── categories (1:N) # Categorias personalizadas
│ └── transactions (1:N) # Transações da categoria
├── transactions (1:N) # Todas as transações
├── budgets (1:N) # Orçamentos por categoria
├── goals (1:N) # Objetivos financeiros
├── refresh_tokens (1:N) # Tokens de refresh
└── notification_logs (1:N) # Histórico de notificações


### Principais Tabelas

| Tabela           | Descrição                                |
| ---------------- | ---------------------------------------- |
| **users**        | Dados de usuários e planos de assinatura |
| **accounts**     | Contas bancárias, cartões, investimentos |
| **transactions** | Despesas, receitas e transferências      |
| **categories**   | Categorias do sistema + personalizadas   |
| **budgets**      | Orçamentos mensais por categoria         |
| **goals**        | Objetivos financeiros (potes virtuais)   |

---

## 🧪 Testes

Testes unitários
npm run test

Testes E2E
npm run test:e2e

Coverage
npm run test:cov


---

## 🔧 Scripts Úteis

### Prisma

npm run prisma:studio # Interface visual do banco
npm run prisma:seed # Popular categorias padrão
npm run prisma:migrate # Criar/aplicar migrations
npm run prisma:generate # Regenerar Prisma Client


### Desenvolvimento

npm run start:dev # Servidor com hot-reload
npm run start:debug # Modo debug
npm run lint # ESLint
npm run format # Prettier


### Build

npm run build # Compilar para produção
npm run start:prod # Rodar produção


---

## 🐳 Docker e Deploy

### Desenvolvimento Local (sem Docker)

Para desenvolvimento rápido, rode diretamente com Node.js:

npm install
npx prisma migrate dev
npm run start:dev


### Desenvolvimento com Docker (opcional)

Se quiser rodar Postgres/Redis localmente com Docker:

Subir apenas banco e cache
docker compose up postgres redis -d

Rodar app normalmente
npm run start:dev


### Build da Imagem Docker

Build para produção
docker build -t miu-controle-backend:latest --target production .

Verificar tamanho (deve ser <300MB)
docker images miu-controle-backend

Testar localmente
docker run -p 3001:3001 --env-file .env miu-controle-backend:latest


---

## 🚀 Deploy em Produção

### CI/CD Automático

Este projeto usa **GitHub Actions** para build e deploy automático:

1. ✅ A cada push na `main`, builda a imagem Docker
2. ✅ Otimiza para produção (multi-stage build < 300MB)
3. ✅ Publica no GitHub Container Registry

**Imagem publicada:**
ghcr.io/rafadegolin/miu-controle-backend:latest


### Deploy no Easypanel

#### 1. Criar App Service

- **Name:** `miu-controle-backend`
- **Source:** Docker Image  
- **Image:** `ghcr.io/rafadegolin/miu-controle-backend:latest`
- **Port:** 3001

#### 2. Configurar Environment Variables

NODE_ENV=production
PORT=3001

Database
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public

Redis (quando implementar)
REDIS_HOST=redis-service-name
REDIS_PORT=6379

JWT
JWT_SECRET=seu-secret-super-seguro-NUNCA-COMMITE
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=seu-refresh-secret-NUNCA-COMMITE
REFRESH_TOKEN_EXPIRES_IN=7d

Frontend (CORS)
FRONTEND_URL=https://seu-frontend.com

MinIO/S3
MINIO_ENDPOINT=seu-minio-host
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=sua-access-key
MINIO_SECRET_KEY=sua-secret-key
MINIO_BUCKET_NAME=avatar-user
MINIO_PUBLIC_URL=https://seu-minio-public-url

Email (Resend)
EMAIL_FROM="Miu Controle noreply@seudominio.com"
RESEND_API_KEY=sua-resend-api-key


#### 3. Deploy

- Clique em **Deploy**
- Acompanhe os logs:
  - ✅ Migrations rodando automaticamente via `docker-entrypoint.sh`
  - ✅ Aplicação iniciando na porta 3001
  - ✅ Healthcheck OK

#### 4. Verificar

Testar endpoint
curl https://seu-backend.easypanel.host/health

Acessar Swagger
https://seu-backend.easypanel.host/api


### Deploy em VPS (Alternativa)

<details>
<summary>📦 Clique para ver instruções de VPS</summary>

#### 1. Preparar servidor

Atualizar sistema
sudo apt update && sudo apt upgrade -y

Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib


#### 2. Configurar banco

sudo -u postgres psql
CREATE DATABASE miu_controle;
CREATE USER miuuser WITH ENCRYPTED PASSWORD 'senha_forte_aqui';
GRANT ALL PRIVILEGES ON DATABASE miu_controle TO miuuser;
\q


#### 3. Deploy da aplicação

Clonar repositório
git clone https://github.com/Rafadegolin/miu-controle-backend.git
cd miu-controle-backend

Instalar dependências
npm ci --only=production

Configurar variáveis
cp .env.example .env
nano .env # Editar com dados de produção

Migrations
npx prisma migrate deploy
npx prisma db seed

Build
npm run build

Process Manager (PM2)
npm install -g pm2
pm2 start dist/main.js --name miu-controle-api
pm2 startup
pm2 save


#### 4. Configurar Nginx (opcional)

server {
listen 80;
server_name api.seudominio.com;
location / {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
}


</details>

---

## 🔧 Troubleshooting

### Build da imagem Docker falhando

Limpar cache do Docker
docker builder prune -a

Rebuild sem cache
docker build --no-cache -t miu-controle-backend .

### Migrations não rodando no Easypanel

- ✅ Verificar logs do container
- ✅ Variável `DATABASE_URL` está correta?
- ✅ Banco está acessível pelo container?
- ✅ `docker-entrypoint.sh` tem permissão de execução?

### Erro de CORS no frontend

// main.ts - Verificar configuração
app.enableCors({
origin: process.env.FRONTEND_URL,
credentials: true,
});

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Siga estes passos:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'feat: Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

### Padrão de Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

feat: Nova funcionalidade
fix: Correção de bug
docs: Documentação
style: Formatação
refactor: Refatoração
test: Testes
chore: Tarefas gerais

---

## 📝 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👨‍💻 Autor

<div align="center">

**Rafael Degolin**

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Rafadegolin)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/rafaeldegolin/)

</div>

---

## 🙏 Agradecimentos

- **NestJS** pela framework incrível
- **Prisma** pela developer experience fantástica
- **Comunidade open-source** pelo suporte

---

## 📞 Suporte

Encontrou um bug? Tem uma sugestão?

👉 [Abra uma issue](https://github.com/Rafadegolin/miu-controle-backend/issues)

---

<div align="center">

**⭐ Se este projeto te ajudou, deixe uma estrela!**

Feito com ❤️ por [Rafael Degolin](https://github.com/Rafadegolin)

</div>