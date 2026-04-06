---
name: "Epic: S4b — Etki analizi (stale traceability)"
about: Üst gereksinim değişince bağlı test/case işaretleme; PLAN_SCM_S4
title: "[Epic] S4b — Etki analizi (ArtifactLink + kurallar)"
labels: []
assignees: []
---

## Amaç

Üst gereksinim (veya seçilen üst tipler) değişince, bağlı **test / case** artifact’larını sistematik olarak **şüpheli / güncellenmeli** olarak işaretlemek.

**Tasarım:** `alm-app/docs/PLAN_SCM_S4_DEPLOY_TRACEABILITY.md` (§2 S4b-1, §1 tablo)

## Önkoşul

- **S4a** tamamlanması zorunlu değildir; ancak ürün önceliği genelde önce deploy görünürlüğüdür.

## Kapsam (öneri)

- [ ] Tetik: manifest `LinkType` + transition veya domain event (ürün kararı)
- [ ] Kalıcılık: `stale_traceability` bayrağı veya ayrı tablo
- [ ] UI: şüpheli işaretli artifact listesi veya rozet
- [ ] Temizleme: kullanıcı “gözden geçirildi” veya test geçişi ile bayrak kaldırma

## İlgili

- `alm-app/docs/PLAN_SCM_TRACEABILITY.md` — Faz S4b özeti
