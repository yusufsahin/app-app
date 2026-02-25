# ALM App — Dokümanlar

Tüm mimari ve süreç dokümanları **tek dizinde** (`docs/`) toplanır. Bu dosya giriş noktası ve bakım kurallarını tanımlar.

---

## Doküman indeksi

### Mimari ve plan

| Doküman | Amaç | Ne zaman kullanılır |
|---------|------|---------------------|
| [alm-app.md](./alm-app.md) | Mimari, tech stack, aşama planı (Phase 1–12) | Yeni geliştirici, mimari karar, faz planı |
| [MPC_BOUNDARY.md](./MPC_BOUNDARY.md) | MPC ile alm-app sorumluluk sınırı | Platform vs uygulama ayrımı, ne nerede |
| [D1_POLICY_ACL_INTEGRATION.md](./D1_POLICY_ACL_INTEGRATION.md) | Policy/ACL entegrasyon planı (GuardPort, AuthPort, field masking) | D1 işi, MPC port implementasyonu |

### Planlama ve ilerleme

| Doküman | Amaç | Ne zaman kullanılır |
|---------|------|---------------------|
| [REMAINING_PLAN.md](./REMAINING_PLAN.md) | Kalan işler (Faz A–E), önerilen sıra | Cycle planlama, ilerleme takibi |
| [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md) | Mevcut vs hedef gap analizi | Durum özeti, eksik özellik listesi |
| [CONTEXTS_AND_PROGRESSION.md](./CONTEXTS_AND_PROGRESSION.md) | Bounded context’ler, ilerleyiş, roadmap | Domain/context anlayışı, sıradaki adımlar |
| [BOARD_CONTEXT.md](./BOARD_CONTEXT.md) | Board context taslağı (Kanban/Scrum) | Board özelliği kapsam ve veri/API özeti |
### Manifest (DSL ve şema)

| Doküman | Amaç | Ne zaman kullanılır |
|---------|------|---------------------|
| [manifest-dsl.md](./manifest-dsl.md) | Manifest DSL grammar ve semantik | DSL geliştirme, parser/validasyon |
| [manifest-schema.md](./manifest-schema.md) | Manifest JSON/yapı (artifact_types, workflows) | API/schema tasarımı, editor validasyonu |

### Referans

| Doküman | Amaç | Ne zaman kullanılır |
|---------|------|---------------------|
| [CONTEXT_COMPARISON_ALM_VS_PAMERA.md](./CONTEXT_COMPARISON_ALM_VS_PAMERA.md) | ALM vs Pamera context karşılaştırması | Referans mimari, terminoloji eşlemesi |

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
- **Platform sınırı?** → [MPC_BOUNDARY.md](./MPC_BOUNDARY.md)  
- **Mevcut durum özeti?** → [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md)
