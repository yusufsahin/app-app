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
| Artifact listesi (proje + isteğe bağlı filtre) | `GET /orgs/.../projects/.../artifacts` (state, type, cycle_id, area_node_id, release_id, q, assignee_id, unassigned_only) |
| State’e göre geçiş | `POST .../artifacts/{id}/transition` (to_state) |
| Workflow state listesi | Manifest’ten (artifact_type → workflow_id → states) |
| Kolon = state | Manifest’teki workflow states ile eşleşir |

Yeni endpoint gerekmez; board UI mevcut list + transition API’yi kullanabilir. İsteğe bağlı: board için hafif bir “artifacts by state” aggregate endpoint (performans için).

---

## 2.1 Uygulanan Board davranışı (`BoardPage`)

- **Veri:** Board, aynı artifact list endpoint’ini kullanır; kartlar listedeki öğelerdir.
- **Görünen adlar:** Kolon başlıkları manifest workflow `states` içindeki `name` alanından (yoksa state `id`); kart rozetinde artifact type `name` (yoksa `id`). Tooltip’lerde ham id gösterilir.
- **Varsayılan artifact type:** Proje başına `localStorage` (`alm.board.typeFilter.<projectId>`); yoksa URL `?type=`; yoksa tahta için seçilebilir tiplerden ilki; seçilebilir tip yoksa boş (All). Seçicide listelenen tipler dışında kalan (ör. `root-*` veya `is_system_root`) kayıtlı/URL değerleri geçersiz sayılır ve yukarıdaki sırayla yeniden seçilir. Kullanıcı tip değiştirince tercih kaydedilir.
- **Sistem kökleri:** Board’daki artifact type seçici, `root-` ile başlayan ve `is_system_root: true` olan manifest tiplerini göstermez. **All** görünümünde kartlar bu kök tiplerden filtrelenir; birleşik kolonlar da yalnızca seçilebilir tiplerin bağlı workflow’larından türetilir. Projede yalnızca kök tipler varsa seçici gizlenir ve liste/kolon davranışı filtre uygulanmadan tüm tiplere göre kalır.
- **Çoklu tip (All):** Birden fazla board-seçilebilir tip varken All seçiliyse kısa bilgi bandı gösterilir (birleşik workflow uyarısı).
- **Sürükle-bırak:** Yalnızca `allowed_actions` içinde `transition` olan kartlar sürüklenir. Hedef kolon, manifest’teki **geçerli geçişler** (`transitions`) ile uyumlu değilse bırakma reddedilir ve kolon sürükleme sırasında soluk gösterilir.
- **Artifact type = All:** Kolonlar, **board’da seçilebilir** artifact type’ların bağlı olduğu workflow’ların state’lerinin **birleştirilmiş** sırasıdır (sistem kök tiplerinin workflow’ları bu birleşime dahil edilmez). Workflow’lar manifest dizisi sırasına göre taranır; aynı state id tekrarlanmaz; yalnızca harf büyüklüğü farkı olan state’ler tek kolonda birleştirilebilir. Yalnızca kök tipler kaldığında birleşim, önceki gibi tüm tipler üzerinden yapılır.
- **Belirli bir type:** Kolonlar, o type’ın workflow’undaki state sırasıdır.
- **Manifest dışı state:** Listede görünen bir artifact’ın `state` değeri bu kolon listesinde yoksa, o state için ek kolon(lar) açılır; sıra, manifest kolonlarının ardından **alfabetik** (ek state’ler arasında).
- **Filtreler:** Arama (`q`), atanan kişi (`assignee_id` veya `unassigned_only`), release/cycle/area ve type (type filtresi istemci tarafında listeden daraltma) board’da kullanılabilir. Özet satırında seçili bağlam (tip, filtreler, gösterilen adet) gösterilir.

---

## 3. UI Taslağı

- **Sayfa:** `/org/project/board` (veya Artifacts içinde “Board” görünümü).
- **Kolonlar:** Seçilen artifact type’ın workflow’undaki state’ler (manifest’ten).
- **Kart:** Artifact key, title, state; sürükleyip başka kolona bırakınca transition API çağrılır.
- **Filtre:** Artifact type, release/cycle, area, arama (`q`) ve atanan kişi (mevcut API ile).

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
