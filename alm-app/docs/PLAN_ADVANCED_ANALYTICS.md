# Plan — İleri Analitik ve Tahmin (Advanced Analytics)

Bu doküman, mevcut **Dashboard (KPI + recent activity)** ve **cycle bazlı velocity / burndown** ([REMAINING_PLAN.md](./REMAINING_PLAN.md) P4–P5) üzerine inşa edilecek **ileri analitik** ve **planlama tahmini** işini tanımlar. Tamamlanan taban: [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md) Planning satırı.

**Hedef:** Yöneticiler ve takım liderleri için “ne zaman biter?” ve “kapasite yeterli mi?” sorularına veriyle cevap; operasyonel tek cam ile birleştirilebilir görünümler.

---

## 1. Mevcut durum (kısa)

| Alan | Durum |
|------|--------|
| KPI kartları, son aktiviteler | Var (D3) |
| Cycle velocity | Var (P4) |
| Cycle burndown | Var (P5) |
| Team bağlamı (`team_id`) | Var (P6) |
| Kişi/takım **capacity** (planlan saat, müsaitlik) | Yok — [PLAN_IMPROVEMENTS_D1_TASK_CAPACITY_TEAM.md](./PLAN_IMPROVEMENTS_D1_TASK_CAPACITY_TEAM.md) §3 |
| Olasılıksal tamamlanma tarihi (forecast) | Yok |
| Çok boyutlu kesimler (takım × tip × alan) | Kısmi / ürün kararı |

---

## 2. Öncelikli boşluklar (ürün sırası önerisi)

### A. Capacity + yük karşılaştırması (önkoşul)

- **Capacity:** `team_id` ve/veya `user_id` bazlı, cycle veya tarih aralığı için planlanan saat / story point “budget”.
- **Load:** Aynı dönemde atanan artifact’ların effort toplamı (mevcut effort konvansiyonu ile — aynı P4 dokümanındaki effort alanı).
- **Çıktı:** Planning veya Dashboard’da “committed vs capacity” göstergesi, aşım uyarısı.

Bu olmadan “forecast” yalnızca geçmiş hıza dayalı tahmin olur; planlı kapasiteyle birleşince yönetilebilir hale gelir.

### B. Basit forecast (deterministik + band)

- Girdi: son N cycle’ın velocity dağılımı veya ortalama; kalan iş (remaining effort veya iş sayısı).
- Çıktı: **beklenen tamamlanma cycle’ı** ve isteğe bağlı **pessimistic/optimistic** band (ör. percentil veya sabit çarpan).
- UI: Seçili release/cycle için tek satır özet veya küçük sparkline.

### C. Gelişmiş analitik (sonraki dalga)

- **Monte Carlo / olasılık:** Throughput örneklemesi ile tarih dağılımı (ürün karmaşıklığı ve eğitim maliyeti yüksek; enterprise talebine göre).
- **Trend ve anomali:** Velocity düşüşü, WIP artışı, cycle süresi uyarıları.
- **Cohort / lead time:** Tip veya area bazlı cycle time histogramı.

### D. Okuma modeli ve performans

- Yoğun sorgular için **read model** veya özet tablolar (materialized view); tenant bazlı partition/index.
- Gecelik veya transition sonrası artımlı güncelleme (event’ten tetiklenebilir).

---

## 3. Faz önerisi (A1–A3)

| Faz | İçerik | Kabul kriteri (özet) |
|-----|--------|----------------------|
| **A1** | Capacity entity + API; cycle ile ilişki; temel UI | Takım için cycle bazlı “planned hours” girilir; raporda görünür |
| **A2** | Load vs capacity karşılaştırması (grafik veya tablo) | Aşım durumunda görsel veya etiket |
| **A3** | Forecast endpoint + UI (deterministik + basit band) | Kalan iş + geçmiş velocity ile tahmini cycle/tarih gösterilir |

**A4 (opsiyonel):** Monte Carlo, özel dashboard sayfaları, dışa aktarma (CSV/PDF).

---

## 4. Veri ve tanımlar

- **Done tanımı:** Mevcut workflow’daki “done” state(leri) — manifest veya proje config ile tek kaynak.
- **Effort birimi:** Story point veya saat — tenant veya proje bazlı tek konvansiyon (P4 planı ile uyumlu).
- **Takım:** Mevcut `Team` / `TeamMember` modeli; capacity öncelikle takım bazlı, ikincil kullanıcı bazlı genişletilebilir.

---

## 5. İzleme ve gizlilik

- Agregasyonlar mümkün olduğunca kişisel veri içermez; assignee bazlı raporlar izin kontrolü altında ([D1_POLICY_ACL_INTEGRATION.md](./D1_POLICY_ACL_INTEGRATION.md)).

---

## 6. SCM / DevOps ile kesişim

- Dağıtım ve ortam metrikleri ayrı planda ([PLAN_SCM_TRACEABILITY.md](./PLAN_SCM_TRACEABILITY.md) Faz S4). İleri analitikte “production incident sayısı / cycle” gibi göstergeler ikinci aşamada bağlanabilir.

---

## İlgili dokümanlar

- [REMAINING_PLAN.md](./REMAINING_PLAN.md) — P4, P5, P6
- [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md)
- [PLAN_IMPROVEMENTS_D1_TASK_CAPACITY_TEAM.md](./PLAN_IMPROVEMENTS_D1_TASK_CAPACITY_TEAM.md)
- [TRANSITION_OBSERVABILITY.md](./TRANSITION_OBSERVABILITY.md) — Metrik/otel ile operasyonel görünürlük

— ↑ [Dokümanlar](README.md)
