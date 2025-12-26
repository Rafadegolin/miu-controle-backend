.PHONY: up down logs shell migrate seed build clean restart ps

# Subir containers (Postgres + Redis + Backend)
up:
	docker-compose up -d

# Parar containers
down:
	docker-compose down

# Ver logs do backend
logs:
	docker-compose logs -f backend

# Ver todos os logs
logs-all:
	docker-compose logs -f

# Entrar no container
shell:
	docker-compose exec backend sh

# Rodar migrations
migrate:
	docker-compose exec backend npx prisma migrate dev

# Rodar seed
seed:
	docker-compose exec backend npx prisma db seed

# Buildar imagem
build:
	docker-compose build --no-cache

# Limpar tudo (remove volumes)
clean:
	docker-compose down -v
	docker system prune -f

# Reiniciar containers
restart:
	docker-compose restart

# Ver status
ps:
	docker-compose ps

# Logs do Postgres
logs-db:
	docker-compose logs -f postgres

# Logs do Redis
logs-redis:
	docker-compose logs -f redis

# Rebuild e restart
rebuild:
	docker-compose down
	docker-compose build
	docker-compose up -d

# Parar apenas backend (mantém DB e Redis)
stop-backend:
	docker-compose stop backend

# Iniciar apenas backend
start-backend:
	docker-compose start backend
