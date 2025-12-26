###################
# BUILD FOR LOCAL DEVELOPMENT
###################
FROM node:18-alpine AS development

# Adicionar bibliotecas necessárias + netcat
RUN apk add --no-cache libc6-compat netcat-openbsd

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Usuário não-root
USER node

###################
# BUILD FOR PRODUCTION
###################
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências (incluindo devDependencies para build)
RUN npm ci

COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Compilar aplicação
RUN npm run build

# Remover devDependencies
RUN npm ci --only=production && npm cache clean --force

###################
# PRODUCTION
###################
FROM node:18-alpine AS production

# Adicionar netcat para healthcheck
RUN apk add --no-cache netcat-openbsd

WORKDIR /app

# Copiar node_modules otimizado
COPY --from=build /app/node_modules ./node_modules

# Copiar código compilado
COPY --from=build /app/dist ./dist

# Copiar Prisma
COPY --from=build /app/prisma ./prisma

# Copiar entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Usar entrypoint para migrations
ENTRYPOINT ["./docker-entrypoint.sh"]
