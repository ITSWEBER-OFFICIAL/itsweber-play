.PHONY: help dev up down logs build seed migrate backup shell-api shell-web shell-worker

help:
	@echo "ITSWEBER Play — Make targets"
	@echo "  dev       - docker-compose.dev.yml up (with hot-reload)"
	@echo "  up        - docker-compose.yml up -d (production)"
	@echo "  down      - stop all containers"
	@echo "  logs      - tail all container logs"
	@echo "  build     - (re)build all images"
	@echo "  seed      - run Prisma seed in play-api"
	@echo "  migrate   - run Prisma migrations in play-api"
	@echo "  backup    - dump Postgres + MinIO to /mnt/user/Backup"
	@echo "  shell-*   - open a shell in the named container"

dev:
	docker compose -f docker-compose.dev.yml up --build

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

build:
	docker compose build --no-cache

seed:
	docker compose exec play-api pnpm --filter @play/db seed

migrate:
	docker compose exec play-api pnpm --filter @play/db migrate:deploy

backup:
	./scripts/backup.sh

shell-api:
	docker compose exec play-api sh

shell-web:
	docker compose exec play-web sh

shell-worker:
	docker compose exec play-worker sh
