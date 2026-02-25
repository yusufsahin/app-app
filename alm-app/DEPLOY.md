# ALM Docker

```bash
cd alm-app
docker compose up --build
```

- App: http://localhost:3000
- API: http://localhost:8000
- MailHog: http://localhost:8025

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

```bash
cd alm-app/backend
uv run python scripts/reset_db.py
```

Sonrasında uygulamayı başlatın; seed otomatik çalışır.

---

## Path Dependencies (Local Dev + Docker)

Backend, MPC ve statelesspy için path dependency kullanabilir (PyPI’da yoksa).

### Local geliştirme

1. **MPC:** `manifest-platform-core-suite` — alm-app ile aynı üst dizinde (örn. `../manifest-platform-core-suite`)
2. **statelesspy:** Workflow adapter state grafiği için — aynı workspace’te (örn. `../../../statelesspy`)

`backend/pyproject.toml` örneği:

```toml
[tool.uv.sources]
mpc = { path = "../../manifest-platform-core-suite" }
statelesspy = { path = "../../../statelesspy" }
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

Build context sınırlaması nedeniyle `../` genelde çalışmaz; MPC’yi alm-app altına veya submodule olarak ekleyin. statelesspy için de aynı şekilde image’a COPY veya submodule ile dahil edin.

### README notu

Geliştirici kurulumunda MPC ve (isteğe bağlı) statelesspy’nin nereye klonlanacağını belirtin.

---

## Testler ve PostgreSQL

Entegrasyon testleri PostgreSQL ister. (1) Docker ile test container otomatik başlar (`backend/tests/README.md`). (2) Veya `ALM_TEST_DATABASE_URL` ile mevcut DB kullanılır. CI'da servis Postgres kullanılır.
