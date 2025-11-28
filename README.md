# 💰 Miu Controle - Backend

<div align="center">

![Miu Controle](https://img.shields.io/badge/Miu%20Controle-Backend-6366F1?style=for-the-badge)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

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

### 🔜 Roadmap

- [ ] **Orçamentos** - Definir limites mensais por categoria
- [ ] **Objetivos (Potes Virtuais)** - Guardar dinheiro para metas específicas
- [ ] **Categorização Automática** - IA aprende seus padrões de gasto
- [ ] **Notificações Bancárias** - Registro automático via SMS (Android)
- [ ] **Open Banking** - Integração com Pluggy/Belvo
- [ ] **SaaS/Assinaturas** - AbacatePay para planos Pro e Family

---

## 🛠️ Stack Tecnológica

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **NestJS** | 11.x | Framework Node.js progressivo |
| **Prisma** | 5.x | ORM TypeScript-first |
| **PostgreSQL** | 15+ | Banco relacional |
| **TypeScript** | 5.x | Linguagem tipada |
| **JWT** | - | Autenticação stateless |
| **class-validator** | - | Validação de DTOs |
| **Swagger** | - | Documentação OpenAPI |

---

## 📋 Pré-requisitos

Antes de começar, você precisará ter instalado:

- [Node.js](https://nodejs.org/) 20 ou superior
- [PostgreSQL](https://www.postgresql.org/download/) 15 ou superior
- npm ou yarn

---

## 🚀 Instalação e Setup

### 1. Clone o repositório

git clone https://github.com/Rafadegolin/miu-controle-backend.git
cd miu-controle-backend

text

### 2. Instale as dependências

npm install

text

### 3. Configure as variáveis de ambiente

Copie o arquivo de exemplo:

cp .env.example .env

text

Edite o `.env` com suas configurações:

Database
DATABASE_URL="postgresql://usuario:senha@localhost:5432/miucontrole?schema=public"

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

text

### 4. Execute as migrations do Prisma

npm run prisma:migrate

text

### 5. Popule as categorias padrão

npm run prisma:seed

text

Isso criará 19 categorias com cores e ícones:
- 🍽️ Alimentação, 🚗 Transporte, 🏠 Moradia, 🏥 Saúde, etc.

### 6. Inicie o servidor

Desenvolvimento (hot-reload)
npm run start:dev

Produção
npm run build
npm run start:prod

text

✅ A API estará rodando em `http://localhost:3001`

---

## 📚 Documentação da API

### Swagger UI (Interativo)

Após iniciar o servidor, acesse:

👉 [**http://localhost:3001/api/docs**](http://localhost:3001/api/docs)

![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=flat&logo=swagger&logoColor=black)

### Endpoints Principais

#### 🔐 Autenticação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/auth/register` | Criar nova conta |
| `POST` | `/auth/login` | Fazer login (retorna JWT) |
| `GET` | `/auth/me` | Dados do usuário autenticado |

#### 🏦 Contas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/accounts` | Criar conta bancária |
| `GET` | `/accounts` | Listar todas as contas |
| `GET` | `/accounts/balance` | Saldo total consolidado |
| `GET` | `/accounts/:id` | Buscar conta específica |
| `PATCH` | `/accounts/:id` | Atualizar conta |
| `DELETE` | `/accounts/:id` | Desativar conta |

#### 💸 Transações

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/transactions` | Criar transação |
| `GET` | `/transactions` | Listar com filtros |
| `GET` | `/transactions/stats/monthly` | Estatísticas mensais |
| `GET` | `/transactions/stats/category/:id` | Stats por categoria |
| `GET` | `/transactions/:id` | Buscar transação |
| `PATCH` | `/transactions/:id` | Atualizar transação |
| `DELETE` | `/transactions/:id` | Deletar transação |

### Exemplo de Requisição

1. Fazer login
curl -X POST http://localhost:3001/auth/login
-H "Content-Type: application/json"
-d '{"email":"seu@email.com","password":"SuaSenha@123"}'

2. Criar transação (com token)
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

text

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

text

### Principais Tabelas

| Tabela | Descrição |
|--------|-----------|
| **users** | Dados de usuários e planos de assinatura |
| **accounts** | Contas bancárias, cartões, investimentos |
| **transactions** | Despesas, receitas e transferências |
| **categories** | Categorias do sistema + personalizadas |
| **budgets** | Orçamentos mensais por categoria |
| **goals** | Objetivos financeiros (potes virtuais) |

---

## 🧪 Testes

Testes unitários
npm run test

Testes E2E
npm run test:e2e

Coverage
npm run test:cov

text

---

## 🔧 Scripts Úteis

### Prisma

npm run prisma:studio # Interface visual do banco
npm run prisma:seed # Popular categorias padrão
npm run prisma:migrate # Criar/aplicar migrations
npm run prisma:generate # Regenerar Prisma Client

text

### Desenvolvimento

npm run start:dev # Servidor com hot-reload
npm run start:debug # Modo debug
npm run lint # ESLint
npm run format # Prettier

text

### Build

npm run build # Compilar para produção
npm run start:prod # Rodar produção

text

---

## 📦 Deploy

### Opção 1: VPS (Hostinger, DigitalOcean, AWS EC2)

#### 1. Preparar servidor

Atualizar sistema
sudo apt update && sudo apt upgrade -y

Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib

text

#### 2. Configurar banco

sudo -u postgres psql
CREATE DATABASE miucontrole;
CREATE USER miuuser WITH ENCRYPTED PASSWORD 'senha_forte_aqui';
GRANT ALL PRIVILEGES ON DATABASE miucontrole TO miuuser;
\q

text

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
npm run prisma:migrate
npm run prisma:seed

Build
npm run build

Process Manager (PM2)
npm install -g pm2
pm2 start dist/main.js --name miu-controle-api
pm2 startup
pm2 save

text

#### 4. Configurar Nginx (opcional)

server {
listen 80;
server_name api.seudominio.com;

text
location / {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
}

text

### Opção 2: Docker

**Dockerfile:**

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3001
CMD ["npm", "run", "start:prod"]

text

**docker-compose.yml:**

version: '3.8'

services:
postgres:
image: postgres:15-alpine
environment:
POSTGRES_DB: miucontrole
POSTGRES_USER: miuuser
POSTGRES_PASSWORD: ${DB_PASSWORD}
volumes:
- postgres_data:/var/lib/postgresql/data
ports:
- "5432:5432"

api:
build: .
environment:
DATABASE_URL: postgresql://miuuser:${DB_PASSWORD}@postgres:5432/miucontrole
JWT_SECRET: ${JWT_SECRET}
REFRESH_TOKEN_SECRET: ${REFRESH_TOKEN_SECRET}
ports:
- "3001:3001"
depends_on:
- postgres

volumes:
postgres_data:

text

**Executar:**

docker-compose up -d

text

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

text

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
