# ALM Backend Tests

## Running tests (no skip)

Integration tests need PostgreSQL. Use one of the following so that **no tests are skipped**.

### A) Test Postgres with Docker Compose (önerilen)

```bash
cd backend
docker compose -f docker-compose.test.yml up -d
uv sync --extra dev
set ALM_TEST_DATABASE_URL=postgresql+asyncpg://alm:alm_dev_password@localhost:25433/alm_test
uv run pytest
docker compose -f docker-compose.test.yml down
```

(Linux/macOS: `export ALM_TEST_DATABASE_URL=...`). Compose maps Postgres to host port **25433** (avoids clashing with app DB on 5433 and reduces issues with Windows reserved port ranges).

### B) Test container (testcontainers)

Docker çalışıyorsa testcontainers otomatik bir Postgres container başlatır:

```bash
cd backend
uv sync --extra dev
uv run pytest
```

### C) Mevcut veritabanı

```bash
ALM_TEST_DATABASE_URL="postgresql+asyncpg://alm:alm_dev_password@localhost:5432/alm_test" uv run pytest
```

## Demo seed (uçtan uca API)

Tam `run_startup_seeds` + demo tenant + `tree=requirement` backlog doluluğu, **diğer entegrasyon testlerinden bağımsız** bir veritabanında doğrulanır (`alm_demo_seed_e2e`, aynı Postgres sunucusunda yeni DB adı).

```bash
cd backend
# Postgres erişimi (compose veya testcontainers) ile:
uv run pytest tests/test_demo_seed_stack.py -v --log-cli-level=INFO
```

Log satırları için `--log-cli-level=INFO` kullan (`alm.tests.demo_seed_stack`).

## Hızlı (sadece unit testler)

PostgreSQL olmadan sadece unit testler çalışır; entegrasyon testleri skip edilir:

```bash
uv run pytest tests/unit -q
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `ALM_TEST_DATABASE_URL` | Test PostgreSQL URL. Set edilirse container başlatılmaz. |
| `ALM_USE_TEST_CONTAINER` | Default `1`. `0` yaparsanız sadece fallback (compose veya local) kullanılır. |

## CI

CI'da `ALM_TEST_DATABASE_URL` servis Postgres'ine ayarlıdır; tüm testler (entegrasyon dahil) koşar.
