#!/bin/sh
set -e

echo "🔄 Aguardando PostgreSQL..."

# Extrair host e porta da DATABASE_URL
# Formato: postgresql://user:pass@host:port/dbname
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')

# Se não conseguir extrair, usar valores padrão
if [ -z "$DB_HOST" ]; then
  DB_HOST="postgres"
fi

if [ -z "$DB_PORT" ]; then
  DB_PORT="5432"
fi

echo "📍 Conectando em: $DB_HOST:$DB_PORT"

# Aguardar PostgreSQL estar disponível (timeout 60s)
RETRIES=30
until nc -z "$DB_HOST" "$DB_PORT" >/dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo "⏳ Postgres indisponível - aguardando..."
  RETRIES=$((RETRIES-1))
  sleep 2
done

if [ $RETRIES -eq 0 ]; then
  echo "❌ Timeout: PostgreSQL não está acessível em $DB_HOST:$DB_PORT"
  echo "⚠️  Tentando iniciar aplicação mesmo assim..."
else
  echo "✅ PostgreSQL conectado!"
fi

# Executar migrations (se RUN_SEED não for explicitamente "false")
if [ "$RUN_SEED" != "false" ]; then
  echo "🔄 Executando migrations..."
  npx prisma migrate deploy || {
    echo "⚠️  Migrations falharam, mas continuando..."
  }
else
  echo "⏭️  Migrations desabilitadas (RUN_SEED=false)"
fi

# Iniciar aplicação
echo "🚀 Iniciando aplicação..."
exec node dist/main.js
