#!/bin/sh
set -e

echo "🔄 Aguardando PostgreSQL..."
until nc -z ${DATABASE_HOST:-postgres} ${DATABASE_PORT:-5432}; do
  echo "⏳ Postgres indisponível - aguardando..."
  sleep 2
done

echo "✅ PostgreSQL conectado!"

echo "🔄 Executando migrations..."
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "🌱 Executando seed..."
  npx prisma db seed
fi

echo "🚀 Iniciando aplicação..."
exec node dist/main.js
