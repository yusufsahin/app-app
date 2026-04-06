# Board Context — Kanban / flow

Proje **Board** sayfası Kanban tarzı akış panosudur. Güncel iş listesi için [REMAINING_PLAN.md](./REMAINING_PLAN.md) ve [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md) kullanılır.

**Motor (frontend):** Saf mantık [`frontend/src/shared/lib/board/`](../frontend/src/shared/lib/board/) altında — `buildFlowBoardColumnModel`, `groupArtifactsByFlowColumns`, `canDropOnFlowColumn`, `flowBoardStrategy`. Geçiş kuralları `getValidTransitionsFromBundle` ile manifest `transitions` üzerinden okunur.

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
| Kolon = state (veya kategori) | Varsayılan: workflow `states` sırası; isteğe bağlı `board.surfaces.default` ile özelleştirme ([manifest-schema.md](./manifest-schema.md) **Board** bölümü) |

Yeni endpoint gerekmez; board UI mevcut list + transition API’yi kullanır. İsteğe bağlı: board için hafif bir “artifacts by state” aggregate endpoint (performans için). Manifest kaydında `board` alanı `validate_manifest_board_section` ile doğrulanır.

---

## 2.1 Uygulanan Board davranışı (`BoardPage`)

- **Veri:** Board, aynı artifact list endpoint’ini kullanır; kartlar listedeki öğelerdir.
- **Görünen adlar:** Kolon başlıkları manifest workflow `states` içindeki `name` alanından (yoksa state `id`); kart rozetinde artifact type `name` (yoksa `id`). Tooltip’lerde ham id gösterilir.
- **Varsayılan artifact type:** Her zaman geçerli bir tip seçilidir; **All / boş seçenek yok.** Sıra: proje başına `localStorage` (`alm.board.typeFilter.<projectId>`, boş değer yok sayılır); yoksa URL `?type=` (boş yok sayılır); yoksa tahta için seçilebilir tiplerden ilki; seçilebilir tip yoksa manifest’teki **ilk** artifact type. Seçicide listelenen tipler dışında kalan (ör. `root-*` veya `is_system_root`) kayıtlı/URL değerleri geçersiz sayılır ve yukarıdaki sırayla yeniden seçilir. Kullanıcı tip değiştirince dolu tercih kaydedilir.
- **Sistem kökleri:** Board’daki artifact type seçici, `root-` ile başlayan ve `is_system_root: true` olan manifest tiplerini göstermez. Projede yalnızca bu kök tipler varsa seçici gizlenir; varsayılan tip manifest’teki ilk tip olur ve liste API’si o tipe göre filtrelenir.
- **Sürükle-bırak:** Yalnızca `allowed_actions` içinde `transition` olan kartlar sürüklenir. Hedef kolon, manifest’teki **geçerli geçişler** (`transitions`) ile uyumlu değilse bırakma reddedilir ve kolon sürükleme sırasında soluk gösterilir.
- **Kolonlar:** Varsayılan olarak seçili artifact type’ın workflow’undaki state sırasıdır; `board.surfaces.default.column_source: state_category` ise kolonlar state `category` değerleridir. `hide_state_ids` ve `column_order_override` manifest’ten uygulanır. Manifest henüz yüklenmeden veya tip alanı geçici boşken (edge) kolonlar, seçilebilir tiplerin workflow birleşimine veya tüm tiplere göre yedeklenebilir.
- **Manifest dışı state:** Listede görünen bir artifact’ın `state` değeri bu kolon listesinde yoksa, o state için ek kolon(lar) açılır; sıra, manifest kolonlarının ardından **alfabetik** (ek state’ler arasında).
- **Filtreler:** Arama (`q`), atanan kişi (`assignee_id` veya `unassigned_only`), release/cycle/area ve artifact type (API’ye `artifact_type` filtresi; manifest hydrate olana kadar liste isteği bekletilir) board’da kullanılabilir. Özet satırında seçili bağlam (tip, filtreler, gösterilen adet) gösterilir.

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
- [manifest-schema.md](./manifest-schema.md) — Workflow, artifact_types, **Board**

— ↑ [Dokümanlar](README.md)
