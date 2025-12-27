###################
# BUILD
###################
FROM node:20.11-alpine3.18 AS builder

# Instalar dependências necessárias (OpenSSL 1.1 para Prisma)
RUN apk add --no-cache openssl1.1-compat

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate

RUN npm run build

###################
# PRODUCTION
###################
FROM node:20.11-alpine3.18 AS production

# Instalar netcat para healthcheck e OpenSSL 1.1 para Prisma
RUN apk add --no-cache netcat-openbsd openssl1.1-compat

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY prisma ./prisma

RUN npx prisma generate

COPY --from=builder /app/dist ./dist

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
