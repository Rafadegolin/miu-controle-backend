###################
# BUILD
###################
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar todas as dependências (incluindo devDependencies para build)
RUN npm ci

# Copiar código fonte
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# 🐛 DEBUG: Verificar estrutura antes do build
RUN echo "📂 Estrutura ANTES do build:" && ls -la /app

# Compilar aplicação TypeScript -> JavaScript
RUN npm run build

# 🐛 DEBUG: Verificar se dist foi criado
RUN echo "📂 Estrutura DEPOIS do build:" && ls -la /app
RUN echo "📂 Conteúdo de /app/dist:" && ls -la /app/dist || echo "❌ dist/ NÃO EXISTE!"

###################
# PRODUCTION
###################
FROM node:18-alpine

# Adicionar netcat para healthcheck do PostgreSQL
RUN apk add --no-cache netcat-openbsd

WORKDIR /app

# Copiar package*.json
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && npm cache clean --force

# Copiar Prisma schema
COPY prisma ./prisma

# Gerar Prisma Client no stage de produção
RUN npx prisma generate

# Copiar código compilado do stage anterior
COPY --from=builder /app/dist ./dist

# 🐛 DEBUG: Verificar se dist foi copiado para produção
RUN echo "📂 Estrutura PRODUÇÃO:" && ls -la /app
RUN echo "📂 Conteúdo de /app/dist:" && ls -la /app/dist || echo "❌ dist/ NÃO COPIADO!"

# Copiar entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Usar entrypoint para aguardar PostgreSQL e executar migrations
ENTRYPOINT ["./docker-entrypoint.sh"]
