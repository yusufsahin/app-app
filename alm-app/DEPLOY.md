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

## MPC Path Dependency (Local Dev + Docker)

MPC (`manifest-platform-core-suite`) public PyPI'da değilse path dependency kullanın.

### Local geliştirme

1. MPC'yi `../manifest-platform-core-suite` konumuna klonlayın (alm-manifest-app ile aynı üst dizinde)
2. `pyproject.toml` örneği:

```toml
[tool.uv.sources]
manifest-platform-core-suite = { path = "../manifest-platform-core-suite" }
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

Build context sınırlaması nedeniyle `../` genelde çalışmaz; MPC'yi alm-app altına (`alm-app/mpc`) veya submodule olarak ekleyin.

### README notu

Geliştirici kurulumunda MPC'nin nereye klonlanacağını belirtin.
