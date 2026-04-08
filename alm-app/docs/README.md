# ALM App — Dokümanlar

Tüm mimari ve süreç dokümanları **tek dizinde** (`docs/`) toplanır. Bu dosya giriş noktası ve bakım kurallarını tanımlar.

---

## Doküman indeksi

### Kullanıcı rehberi (ürün içi HTML)

| Doküman | Amaç |
|---------|------|
| [USER_TUTORIAL_EN.md](./USER_TUTORIAL_EN.md) | Son kullanıcı kılavuzu (İngilizce) — kaynak Markdown |
| [USER_TUTORIAL_TR.md](./USER_TUTORIAL_TR.md) | Son kullanıcı kılavuzu (Türkçe) — kaynak Markdown |

`npm run build` veya `vite` dev sunucusu açılırken bu dosyalar `frontend/public/docs/` altına kopyalanır; giriş yapmış kullanıcılar uygulamada `/{orgSlug}/help/tutorial/en` veya `.../tr` adresinde **Markdown → HTML** (tablolar dahil) olarak görür. Header’daki **Help** (?) düğmesi varsayılan olarak bu sayfaya gider.

### Pazarlama ve satış

| Doküman | Amaç | Ne zaman kullanılır |
|---------|------|---------------------|
| [MARKETING_MESSAGE_FRAMEWORK_TR.md](./MARKETING_MESSAGE_FRAMEWORK_TR.md) | Ürün konumlandırma, mesaj hiyerarşisi, pitch ve iddia sınırları | Landing, satış sunumu, teklif öncesi mesaj hizası |
| [LANDING_PAGE_COPY_TR.md](./LANDING_PAGE_COPY_TR.md) | Türkçe landing page kopyası | Web sayfası, kampanya sayfası, içerik taslağı |
| [ONE_PAGER_TR.md](./ONE_PAGER_TR.md) | Tek sayfalık ürün özeti | Satış PDF'i, teklif eki, kısa ürün anlatımı |
| [DEMO_SCRIPT_TR.md](./DEMO_SCRIPT_TR.md) | Demo akışı, konuşma metni ve hazırlık listesi | Canlı demo, keşif görüşmesi, satış sunumu |

### Mimari ve plan

| Doküman | Amaç | Ne zaman kullanılır |
|---------|------|---------------------|
| [alm-app.md](./alm-app.md) | Mimari, tech stack, aşama planı (Phase 1–12) | Yeni geliştirici, mimari karar, faz planı |
| [MPC_BOUNDARY.md](./MPC_BOUNDARY.md) | MPC ile alm-app sorumluluk sınırı | Platform vs uygulama ayrımı, ne nerede |
| [D1_POLICY_ACL_INTEGRATION.md](./D1_POLICY_ACL_INTEGRATION.md) | Policy/ACL entegrasyon planı (GuardPort, AuthPort, field masking) | D1 işi, MPC port implementasyonu. Field masking refactor/taşıma **out of scope**. |

### Planlama ve ilerleme

| Doküman | Amaç | Ne zaman kullanılır |
|---------|------|---------------------|
| [DEPLOY_EXTERNAL_NGINX.md](./DEPLOY_EXTERNAL_NGINX.md) | Üretim: harici nginx, TLS, demo host | Sunucu deploy, reverse proxy |
| [REMAINING_PLAN.md](./REMAINING_PLAN.md) | Kalan işler (Faz A–E), önerilen sıra | Cycle planlama, ilerleme takibi |
| [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md) | Mevcut vs hedef gap analizi | Durum özeti, eksik özellik listesi |
| [PLAN_SCM_TRACEABILITY.md](./PLAN_SCM_TRACEABILITY.md) | Git PR/commit ↔ artifact izlenebilirliği (S1–S3 üründe; S4 tasarım ayrı dosyada) | Webhook/policy ayarları için [manifest-schema.md](./manifest-schema.md); DevOps tek cam |
| [PLAN_SCM_S4_DEPLOY_TRACEABILITY.md](./PLAN_SCM_S4_DEPLOY_TRACEABILITY.md) | Faz S4: deploy event şeması, S4a/S4b epik, issue şablonu | Ortam × commit × artifact; analitik ile [PLAN_ADVANCED_ANALYTICS.md](./PLAN_ADVANCED_ANALYTICS.md) §6 |
| [PLAN_ADVANCED_ANALYTICS.md](./PLAN_ADVANCED_ANALYTICS.md) | Capacity, load vs capacity, forecast, okuma modeli | Planning/dashboard derinliği; P4/P5 üzeri |
| [CONTEXTS_AND_PROGRESSION.md](./CONTEXTS_AND_PROGRESSION.md) | Bounded context’ler, ilerleyiş, roadmap | Domain/context anlayışı, sıradaki adımlar |
| [MANIFEST_METADATA_MASTER_PLAN.md](../../docs/MANIFEST_METADATA_MASTER_PLAN.md) | Manifest/metadata tam yol haritası (tamamlananlar + kalan + tüm context’ler) | Metadata-driven borç listesi, öncelik, backfill; kök `docs/` ile aynı yerde |
| [QUALITY_SUITE.md](./QUALITY_SUITE.md) | Quality suite (hub, traceability route, manifest `tree=quality` / `link_types`) | Kalite girişi, özet sayı, izlenebilirlik listesi |
| [QUALITY_TEST_PARAMS_USER_GUIDE.md](./QUALITY_TEST_PARAMS_USER_GUIDE.md) | Test case parametreleri: `test_params_json`, adımlarda `${paramName}` | Test yazımı, dataset, manuel run |
| [BOARD_CONTEXT.md](./BOARD_CONTEXT.md) | Board context taslağı (Kanban/Scrum) | Board özelliği kapsam ve veri/API özeti |
### Manifest ve workflow

| Doküman | Amaç | Ne zaman kullanılır |
|---------|------|---------------------|
| [manifest-dsl.md](./manifest-dsl.md) | Manifest DSL grammar ve semantik | DSL geliştirme, parser/validasyon |
| [manifest-schema.md](./manifest-schema.md) | Manifest JSON/yapı (artifact_types, workflows) | API/schema tasarımı, editor validasyonu |
| [WORKFLOW_API.md](./WORKFLOW_API.md) | Workflow/geçiş HTTP API (permitted-transitions, transition, batch, guard) | API kullanımı, entegrasyon |
| [WORKFLOW_ENGINE_BOUNDARY.md](./WORKFLOW_ENGINE_BOUNDARY.md) | Workflow adapter vs MPC sınırı, guard | Mimari, handler sırası |
| [TRANSITION_OBSERVABILITY.md](./TRANSITION_OBSERVABILITY.md) | Geçiş metrikleri, log, tracing (Prometheus, OTel) | Ops, izleme, alerting |
| [GUARD_EVALUATOR_SECURITY.md](./GUARD_EVALUATOR_SECURITY.md) | Guard güvenlik kuralları ve desteklenen tipler | Guard ekleme, güvenlik |

### Referans

| Doküman | Amaç | Ne zaman kullanılır |
|---------|------|---------------------|
| [CONTEXT_COMPARISON_ALM_VS_PAMERA.md](./CONTEXT_COMPARISON_ALM_VS_PAMERA.md) | ALM vs Pamera context karşılaştırması | Referans mimari, terminoloji eşlemesi |

### Frontend / test

| Doküman | Amaç | Ne zaman kullanılır |
|---------|------|---------------------|
| [FORMS_TEST_CHECKLIST.md](./FORMS_TEST_CHECKLIST.md) | Paylaşılan form bileşenleri (Rhf*) ile taşınan sayfa/dialog’lar için manuel test listesi | Deploy öncesi veya form değişikliği sonrası QA |

**Kök dizin:** [README.md](../README.md) (kurulum, çalıştırma), [DEPLOY.md](../DEPLOY.md) (deploy).

---

## Best practices (MD yönetimi)

1. **Tek dizin**  
   Tüm uygulama/mimari dokümanları `alm-app/docs/` altında tutun. Dağınık `*.md` yerine bu indekse ekleyin.

2. **İsimlendirme**  
   - Özel isim / proje dokümanları: `UPPERCASE_TOPIC.md` (örn. `REMAINING_PLAN.md`, `GAP_ANALYSIS_ALM.md`).  
   - Referans / teknik: `kebab-case.md` (örn. `manifest-dsl.md`, `alm-app.md`).  
   Tutarlılık öncelikli; yeni dosyada bu sınıflardan birini seçin.

3. **Giriş noktası**  
   Yeni doküman eklendiğinde bu `docs/README.md` indeks tablosuna satır ekleyin; “Ne zaman kullanılır” kısa kalsın.

4. **Çapraz referanslar**  
   Dokümanlar arası linklerde **göreli path** kullanın: `[REMAINING_PLAN.md](./REMAINING_PLAN.md)`. Böylece repo taşınsa da linkler bozulmaz.

5. **Dosya sonu**  
   Her MD dosyası **tek satır sonu (newline)** ile bitsin. Çoklu boş satır kullanmayın.

6. **İlgili dokümanlar ve dönüş linki**  
   Uzun dokümanların sonunda “İlgili dokümanlar” listesi tutulabilir; bu README’deki indeks ile uyumlu olsun. İsteğe bağlı: son satıra `— ↑ [Dokümanlar](README.md)` ekleyerek dokümanlar girişine dönüş sağlanır.

7. **Güncel tutma**  
   Tamamlanan işler `REMAINING_PLAN.md` ve `GAP_ANALYSIS_ALM.md` içinde işaretlensin; büyük mimari değişiklikte `alm-app.md` ve ilgili context dokümanları güncellensin.

---

## Hızlı yönlendirme

- **İş listesi / ne yapacağım?** → [REMAINING_PLAN.md](./REMAINING_PLAN.md)  
- **Mimari / fazlar?** → [alm-app.md](./alm-app.md)  
- **Manifest / DSL?** → [manifest-dsl.md](./manifest-dsl.md), [manifest-schema.md](./manifest-schema.md)  
- **Workflow / geçiş API?** → [WORKFLOW_API.md](./WORKFLOW_API.md)  
- **Geçiş metrikleri / observability?** → [TRANSITION_OBSERVABILITY.md](./TRANSITION_OBSERVABILITY.md)  
- **Platform sınırı?** → [MPC_BOUNDARY.md](./MPC_BOUNDARY.md)  
- **Mevcut durum özeti?** → [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md)
