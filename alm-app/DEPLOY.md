# ALM Docker

**Harici nginx / TLS** ile sunucu deploy: [docs/DEPLOY_EXTERNAL_NGINX.md](./docs/DEPLOY_EXTERNAL_NGINX.md) ve `docker-compose.prod.yml`. Örnek ortam değişkenleri: [prod.env.example](./prod.env.example) → `alm-app/.env` olarak kopyalayın.

```bash
cd alm-app
docker compose up --build -d
```

**Published ports** (see `docker-compose.yml`):

- **App (UI + proxied API):** http://localhost:9001 — OpenAPI: http://localhost:9001/api/v1/docs
- **API direct (optional):** http://localhost:9000
- **MailHog UI:** http://localhost:8025
- **Postgres from host:** `localhost:5433` (user `alm`, password `alm_dev_password`, DB `alm`)

Windows: build context must include `alm-manifest-app/...` under the context root. From `alm-app` run `.\docker-build-local.ps1`, or set `ALM_DOCKER_CONTEXT` to the parent of `alm-manifest-app` (e.g. `c:\source`) before `docker compose`.

Local **Vite** dev remains http://localhost:5173 with API on http://localhost:8000; that is separate from Docker ports above.

---

## Demo Seed Data

Boş veritabanında uygulama başlarken otomatik demo verisi oluşturulur:

| Kaynak       | Değer                    |
|--------------|--------------------------|
| **Email**    | `admin@example.com`      |
| **Şifre**    | `Admin123!`              |
| **Org**      | Demo (slug: `demo`)      |
| **Projeler** | Sample Project, Unima    |

Devre dışı bırakmak için: `ALM_SEED_DEMO_DATA=false`

### DB Sıfırlama (Local)

`scripts/reset_db.py` public şemayı düşürür ve **Alembic `upgrade head`** ile tabloları yeniden oluşturur (eski `create_all` yöntemi eksik model import’ları nedeniyle kullanılmıyor).

Docker Compose ile Postgres kullanıyorsanız, host’tan `reset_db` çalıştırmak için `docker-compose.yml` içinde **db** servisine `5433:5432` port eşlemesi vardır:

```powershell
cd alm-app/backend
$env:ALM_DATABASE_URL="postgresql+asyncpg://alm:alm_dev_password@127.0.0.1:5433/alm"
uv run python scripts/reset_db.py
```

Yerel Postgres `localhost:5432` ise `ALM_DATABASE_URL` atlamanız yeterli.

Sonrasında API’yi başlatın; seed (privileges, şablonlar, demo tenant) uygulama **startup**’ında çalışır. Docker Compose: `docker compose up -d backend` (veya tam stack).

---

## Path Dependencies (Local Dev + Docker)

Backend, **MPC** (`manifest-platform-core-suite`) için path dependency kullanır (PyPI’da yok). Workflow grafiği ve policy motoru bu paketten gelir.

### Local geliştirme

1. **MPC:** `manifest-platform-core-suite` — `alm-manifest-app` ile aynı üst dizinde (örn. `../manifest-platform-core-suite`)

`backend/pyproject.toml` örneği:

```toml
[tool.uv.sources]
mpc = { path = "../../manifest-platform-core-suite" }
```

### Docker build

MPC'yi image'a dahil etmek için:

- **Seçenek A:** Multi-stage build'de MPC'yi `COPY` ile kopyalayın
- **Seçenek B:** Git submodule kullanın; `docker build` öncesi `git submodule update --init`

```dockerfile
# Örnek (alm-app ile aynı repo veya build context'te MPC varsa)
COPY ../manifest-platform-core-suite /tmp/mpc
RUN pip install /tmp/mpc
```

Build context sınırlaması nedeniyle `../` genelde çalışmaz; MPC’yi repo yapısına göre `COPY` ile image’a alın veya submodule kullanın.

### README notu

Geliştirici kurulumunda `manifest-platform-core-suite` yolunun `pyproject.toml` ile eşleştiğinden emin olun.

---

## Testler ve PostgreSQL

Entegrasyon testleri PostgreSQL ister. (1) Docker ile test container otomatik başlar (`backend/tests/README.md`). (2) Veya `ALM_TEST_DATABASE_URL` ile mevcut DB kullanılır. CI'da servis Postgres kullanılır.
