# ALM App

Application Lifecycle Management uygulaması: organizasyonlar, projeler, manifest tabanlı artifact (requirement, defect, task) yönetimi ve workflow geçişleri.

## Gereksinimler

- **Python 3.12+** (backend)
- **Node.js 18+** ve **npm** (frontend)
- **PostgreSQL 16** (asyncpg ile)
- **Redis 7** (oturum/cache)

## Projeyi çalıştırma

### 1. Repoyu klonlama

```bash
git clone <repo-url>
cd alm-manifest-app/alm-app
```

### 2. Backend

```bash
cd backend
```

Ortam için `.env` oluşturun (örnek: `cp .env.example .env`) ve gerekirse düzenleyin:

- `ALM_DATABASE_URL` – PostgreSQL bağlantı URL’i
- `ALM_REDIS_URL` – Redis URL’i
- `ALM_JWT_SECRET_KEY` – Üretimde mutlaka değiştirin

Sanal ortam ve bağımlılıklar (uv veya pip):

```bash
# uv ile
uv venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
uv sync

# veya pip ile
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Veritabanı migrasyonları:

```bash
alembic upgrade head
```

Backend’i başlatma:

```bash
uvicorn alm.main:create_app --factory --reload --host 0.0.0.0 --port 8000
```

API: `http://localhost:8000`. Dokümantasyon: `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
```

Geliştirme sunucusu (backend’in 8000’de çalıştığını varsayar):

```bash
npm run dev
```

Tarayıcıda: `http://localhost:5173`.

Production build:

```bash
npm run build
npm run preview   # build çıktısını önizleme
```

## Opsiyonel: Docker

Backend ve frontend için ayrı `Dockerfile`’lar `backend/` ve `frontend/` altında bulunur. Önce PostgreSQL ve Redis’i (ör. Docker Compose) ayağa kaldırıp, backend’i `ALM_DATABASE_URL` ve `ALM_REDIS_URL` ile bu servislere yönlendirebilirsiniz.

## Yapı

- **backend/** – FastAPI, SQLAlchemy (async), Alembic, MPC (manifest-platform-core)
- **frontend/** – React 19, TypeScript, Vite, MUI, TanStack Query
- **docs/** – Mimari ve uygulama dokümanları ([giriş: docs/README.md](docs/README.md))

Rota örnekleri: `/{orgSlug}` (projeler), `/{orgSlug}/dashboard`, `/{orgSlug}/{projectSlug}/artifacts`, `/{orgSlug}/{projectSlug}/manifest`.

## Pre-commit (opsiyonel)

Commit öncesi lint ve format kontrolü için [pre-commit](https://pre-commit.com/) kullanılabilir:

```bash
# Repo kökünde (alm-manifest-app/alm-app)
pip install pre-commit
pre-commit install
```

Kurulumdan sonra her `git commit` öncesi:

- **pre-commit-hooks:** son boşluk, dosya sonu, YAML/JSON, merge conflict kontrolü
- **Backend:** Ruff (lint + format) — `backend/` altındaki Python dosyaları
- **Frontend:** ESLint — `frontend/` altında `npm run lint`

Tüm dosyalarda manuel çalıştırma: `pre-commit run --all-files`
