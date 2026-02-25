###################
# BUILD
###################
FROM node:22-alpine AS builder

# Instalar OpenSSL 3.x (necessário para Prisma com Alpine)
RUN apk add --no-cache openssl

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
FROM node:22-alpine AS production

# Instalar netcat para healthcheck e OpenSSL 3.x para Prisma
RUN apk add --no-cache netcat-openbsd openssl

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma

RUN npx prisma generate

COPY --from=builder /app/dist ./dist

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
