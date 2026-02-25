# Board Context — Kanban/Scrum Taslağı

Board context şu an ALM’de yok; bu doküman ileride eklenebilecek **Kanban/Scrum board** kapsamını özetler. Güncel iş listesi için [REMAINING_PLAN.md](./REMAINING_PLAN.md) ve [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md) kullanılır.

---

## 1. Hedef

- **Kanban:** Workflow state’lere göre kolonlar; artifact’lar sürüklenerek state değiştirilir.
- **Scrum (opsiyonel):** Cycle’a göre board; kolonlar yine state veya status.

Veri kaynağı: Mevcut **artifact** entity + **workflow** (manifest’ten); transition API zaten var (PATCH transition).

---

## 2. Veri ve API

| İhtiyaç | Mevcut |
|--------|--------|
| Artifact listesi (proje + isteğe bağlı filtre) | `GET /orgs/.../projects/.../artifacts` (state, type, cycle_node_id, area_node_id, q) |
| State’e göre geçiş | `POST .../artifacts/{id}/transition` (to_state) |
| Workflow state listesi | Manifest’ten (artifact_type → workflow_id → states) |
| Kolon = state | Manifest’teki workflow states ile eşleşir |

Yeni endpoint gerekmez; board UI mevcut list + transition API’yi kullanabilir. İsteğe bağlı: board için hafif bir “artifacts by state” aggregate endpoint (performans için).

---

## 3. UI Taslağı

- **Sayfa:** `/org/project/board` (veya Artifacts içinde “Board” görünümü).
- **Kolonlar:** Seçilen artifact type’ın workflow’undaki state’ler (manifest’ten).
- **Kart:** Artifact key, title, state; sürükleyip başka kolona bırakınca transition API çağrılır.
- **Filtre:** Artifact type, cycle ve area dropdown’ları (mevcut API ile).

---

## 4. Bağımlılıklar

- Manifest’te en az bir workflow tanımlı ve artifact type’lar workflow’a bağlı (zaten var).
- Frontend: list-schema veya manifest’ten workflow/state listesi alınabilir; form/list schema API’leri mevcut.

---

## 5. İlgili Dokümanlar

- [REMAINING_PLAN.md](./REMAINING_PLAN.md) — Sonraki adımlar: Board context
- [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md) — Board: “Tüm Board context” gap
- [manifest-schema.md](./manifest-schema.md) — Workflow, artifact_types

— ↑ [Dokümanlar](README.md)
