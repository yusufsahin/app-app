# ALM — Harici Nginx ile üretim / demo deploy

Bu kılavuz, ALM’nin **ayrı bir nginx** (ör. başka uygulamalarla aynı sunucuda) arkasında çalıştırılması içindir. Örnek hostname: `demo.pamera.app.provera.net.tr`.

## Güvenlik (önce okuyun)

- **Kök şifreleri sohbet veya repoda saklamayın.** Sunucuya erişim için SSH anahtarı kullanın; sızıntı olduysa şifreyi derhal değiştirin.
- `ALM_POSTGRES_PASSWORD` ve `ALM_JWT_SECRET_KEY` üretimde güçlü ve benzersiz olsun; `.env` dosyası **asla git’e eklenmez**.

## Sunucu hazırlığı (kısa kontrol listesi)

- Docker + Docker Compose v2 kurulu.
- Repo: `alm-manifest-app` içinde `alm-app` ve `manifest-platform-core-suite` (backend imajı MPC’yi **build context** içinden kopyalar).
- `alm-app/.env`: [prod.env.example](../prod.env.example) — güçlü Postgres parolası, `ALM_JWT_SECRET_KEY`, HTTPS `ALM_CORS_ORIGINS` / `ALM_BASE_URL`.
- Seed: Üretimde `ALM_SEED_DEMO_DATA=false` ile demo tenant oluşmaz; privilege/şablon seed’leri yine backend açılışında çalışır. Tek sefer manuel: `docker compose exec backend python scripts/run_seed_once.py` (imajda script vardır).

## 1. Sunucu dizin yapısı ve Docker build context

Backend `Dockerfile`, build context içinde **`alm-manifest-app/...`** yolunu bekler. Tipik yerleşim:

```text
/srv/build/
  alm-manifest-app/          # Bu repo (içinde alm-app + manifest-platform-core-suite)
    alm-app/
    manifest-platform-core-suite/
```

`docker compose` komutunu **`alm-manifest-app/alm-app`** dizininden çalıştırın. Bu durumda context üst dizin `../../` = `/srv/build` olur (yani `alm-manifest-app` klasörünün **bir üst** dizini).

Eğere repoyu farklı isimle klonladıysanız, `ALM_DOCKER_CONTEXT` ortam değişkeni ile context kökünü verin (`docker-compose.yml` ile aynı kural).

```bash
cd /srv/build/alm-manifest-app
git pull
cd alm-app
```

## 2. Ortam dosyası (`.env`)

`alm-app/prod.env.example` dosyasını `.env` olarak kopyalayıp parolaları ve URL’leri doldurun (**gerçek değerleri kendiniz üretin**):

```env
ALM_POSTGRES_USER=alm
ALM_POSTGRES_PASSWORD=<güçlü-parola>
ALM_POSTGRES_DB=alm
ALM_JWT_SECRET_KEY=<uzun-rastgele-string>

# Harici nginx arkasında: sadece localhost’a frontend yayınla
ALM_FRONTEND_PORT_MAPPING=127.0.0.1:9081:80

# Tarayıcıdan gelecek origin (HTTPS)
ALM_CORS_ORIGINS=["https://demo.pamera.app.provera.net.tr"]
ALM_BASE_URL=https://demo.pamera.app.provera.net.tr

# İsteğe bağlı: e-posta (davet vb.)
# ALM_SMTP_HOST=...
# ALM_SMTP_PORT=587
# ALM_SMTP_FROM=noreply@example.com
```

## 3. Stack’i ayağa kaldırma

```bash
cd /path/to/alm-manifest-app/alm-app
docker compose -f docker-compose.prod.yml --env-file .env up --build -d
```

- **Frontend (iç nginx):** varsayılan olarak konteyner içi 80 → host’ta `127.0.0.1:9081` (`.env` ile değiştirilebilir).
- **API:** Doğrudan dışarı açılmaz; UI, aynı docker ağındaki `backend:8000` adresine proxy eder ([`frontend/nginx.conf`](../frontend/nginx.conf)).

Sağlık kontrolü (sunucuda):

```bash
curl -sS http://127.0.0.1:9081/health/liveness
curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:9081/
```

## 4. Sunucudaki ana nginx (ayrı konteyner veya host nginx)

`demo.pamera.app.provera.net.tr` için TLS’i **bu nginx** sonlandırır; ALM konteyneri yalnızca HTTP dinler.

Örnek `server` bloğu (yollar ve sertifika yollarını ortamınıza göre düzenleyin):

```nginx
upstream alm_demo_upstream {
    server 127.0.0.1:9081;
    keepalive 16;
}

server {
    listen 443 ssl http2;
    server_name demo.pamera.app.provera.net.tr;

    # ssl_certificate     /path/to/fullchain.pem;
    # ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://alm_demo_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

WebSocket kullanımı için `Upgrade` / `Connection` başlıkları önemlidir (mevcut `frontend/nginx.conf` ile uyumludur).

Eğer ana nginx de **Docker** içindeyse ve ALM `127.0.0.1:9081` ile erişilemiyorsa:

- ALM frontend portunu `0.0.0.0:9081:80` yapıp güvenlik duvarında yalnızca iç ağa kısıtlayın, **veya**
- Her iki stack’i aynı Docker ağına alıp `proxy_pass http://alm-app-frontend-1:80;` kullanın (proje adına göre konteyner adı değişir).

## 5. DNS

`demo.pamera.app.provera.net.tr` → `185.93.68.19` (veya güncel sunucu IP) A kaydı.

## 6. Sorun giderme

| Belirti | Olası neden |
|--------|----------------|
| `502 Bad Gateway` | ALM frontend çalışmıyor veya yanlış `upstream` port |
| CORS hatası | `ALM_CORS_ORIGINS` tam URL (şema dahil) değil; backend yeniden başlatılmadı |
| Build hata: MPC / COPY | Build context `alm-manifest-app` üst dizininde değil; [DEPLOY.md](../DEPLOY.md) Path Dependencies |
| Migration hata | Postgres volume eski şemada; yalnızca dev’de `down -v` benzeri dikkatli kullanın |

---

## İlgili dokümanlar

- [DEPLOY.md](../DEPLOY.md) — Yerel Docker, demo seed, path bağımlılıkları
- [docker-compose.prod.yml](../docker-compose.prod.yml) — Üretim compose

— ↑ [Dokümanlar](README.md)
