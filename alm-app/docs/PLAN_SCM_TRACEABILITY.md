# Plan — SCM / Kaynak Kod İzlenebilirliği (Traceability)

Bu doküman, ALM’de **artifact ↔ Git (commit, branch, PR/MR)** ilişkisini ürün seviyesinde nasıl kuracağımızı tanımlar. Mevcut durum: [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md) (Traceability satırı); ilişkili özellikler: **ArtifactLink**, manifest **LinkType**.

**Hedef:** Geliştirici ve PM’in aynı “tek cam” üzerinden iş kalemi ile kod değişikliğini görmesi; ileride CI/CD ve dağıtım durumu ile birleştirilebilir.

---

## 1. Problem ve kapsam

| Sorun | Sonuç |
|--------|--------|
| PR/commit bilgisi yalnızca sohbet veya manuel URL ile taşınıyor | Planlama ile kod arasında kopukluk |
| Mevcut **ArtifactLink** yalnızca artifact→artifact | Harici SCM kimliği (repo, SHA, PR numarası) birinci sınıf değil |
| Kalite/regülasyon tarafı “hangi değişiklik bu gereksinimi karşıladı?” sorusuna sistematik cevap üretemiyor | Audit zayıf |

**Kapsam dışı (bu fazda):** Tam Git hosting clone/import; derin kod arama; otomatik merge/branch yönetimi.

---

## 2. İlkeler

1. **Tenant izolasyonu:** Tüm SCM bağlantıları `project_id` (ve gerekirse org) altında; başka projeden veri sızması olmamalı.
2. **Opsiyonel otomasyon, zorunlu manuel yol:** Webhook’lar “nice to have”; en azından API + UI ile PR URL’si veya SHA eklenmeli.
3. **Provider soyutlama:** Ortak alanlar (provider, repo_full_name, ref, sha, pull_request_number, web_url); GitHub ve GitLab aynı modelde.

---

## 3. Önerilen evrim (fazlar)

### Faz S1 — MVP (manuel + API)

- **Veri:** `scm_link` veya `external_code_reference` benzeri tablo veya artifact üzerinde JSONB koleksiyon (tercihen ayrı tablo: sorgu ve indeks için).
  - Önerilen alanlar: `project_id`, `artifact_id`, `provider` (`github` | `gitlab` | `other`), `repo_full_name`, `ref` (branch/tag, opsiyonel), `commit_sha` (kısa/uzun normalize), `pull_request_number` (opsiyonel), `title` (snapshot), `web_url`, `created_by`, `created_at`.
- **API:** CRUD (liste artifact’a göre, oluşturma, silme); `artifact:update` izni ile hizalı.
- **UI:** Artifact detayda “Source / SCM” paneli: link listesi, “Add link” (URL parse veya alan formu).

**Kabul:** Bir story’ye en az bir PR URL’si veya commit SHA kaydedilir; listede tıklanınca provider web’e gider.

### Faz S2 — URL / açıklama metni zenginleştirme

- URL’den `owner/repo`, PR #, commit kısmi parse (GitHub/GitLab bilinen pattern’leri).
- Çift kayıt önleme: aynı `artifact_id` + `commit_sha` veya aynı `pull_request_number` + `repo`.

### Faz S3 — Webhook entagrasyonu (otomasyon)

- **GitHub:** PR `closed` + `merged`, `push` (branch filter ile) → imza doğrulamalı endpoint.
- **GitLab:** Merge push/MR merged webhook benzeri.
- **Eşleme stratejisi (konfigüre edilebilir):**
  - PR başlığı / açıklamasında artifact key veya `#123` pattern;
  - veya branch adı convention (`feature/ALM-123`);
  - veya commit mesajı footer (`Refs: <uuid>` veya `Story: KEY-42`).
- Başarısız eşlemede: “unmatched webhook” kuyruğu veya yalnızca log (operasyonel karar).

### Faz S4 — İleri (ileride)

- “Bu artifact şu an hangi ortamda canlı?” için deploy event’leri ile birleştirme ([PLAN_ADVANCED_ANALYTICS.md](./PLAN_ADVANCED_ANALYTICS.md) ile koordineli okunabilir).
- Otomatik **etki analizi:** üst gereksinim değişince bağlı test artifact’larını “şüpheli” işaretleme (ArtifactLink grafiği + kural motoru).

---

## 4. Güvenlik ve gizlilik

- Webhook secret rotation; repo bazlı token saklama (Vault/Key Vault); webhook fazından itibaren zorunlu.
- Private repo: yalnızca kayıtlı `web_url` gösterilir; içerik çekme (diff) ayrı OAuth/app kurulumu gerektirir — MVP’de zorunlu tutulmayabilir.

---

## 5. Bağımlılıklar

- Mevcut **ACL** (`require_manifest_acl` / artifact update) ile uyum.
- **LinkType** artifact→artifact traceability ile karışmamalı: SCM kayıtları ayrı entity veya açıkça “external” türü.

---

## 6. Ölçüm (başarı kriterleri)

- Artifact başına ortalama SCM bağlantı sayısı; webhook’tan otomatik oluşturulan kayıt oranı (Faz S3 ve sonrası).
- Kullanıcı anket veya destek tickets: “Git ve ALM arasında geçiş süresi” azalması (ürün metriği, opsiyonel).

---

## İlgili dokümanlar

- [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md)
- [REMAINING_PLAN.md](./REMAINING_PLAN.md) — “Faz F” özeti
- [WORKFLOW_API.md](./WORKFLOW_API.md) — İleride “merge sonrası transition” ile entegrasyon ihtimali
- [QUALITY_SUITE.md](./QUALITY_SUITE.md) — Kalite izlenebilirliği bağlamı

— ↑ [Dokümanlar](README.md)
