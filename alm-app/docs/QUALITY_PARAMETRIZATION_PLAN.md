# Quality: Test case parametrizasyonu — ürün ve teknik plan

Bu doküman, test case adımlarında **veri odaklı tekrar** (aynı prosedür, farklı değerler) için planı tanımlar. Mevcut **Call to Test** (`kind: "call"`) prosedür yeniden kullanımıdır; parametrizasyon ise **metin içinde yer tutucular + çalıştırma zamanı değerleri** ile tamamlanır.

## 1. Hedefler

- Tek bir test case tanımında adımlarda `${paramName}` (veya eşdeğeri) kullanılabilsin.
- Çalıştırma sırasında (manuel run player) kullanıcı **hangi veri satırının** kullanılacağını seçebilsin veya tek satırlık varsayılanla otomatik dolsun.
- Run kaydında hem **şablon** hem **o koşuda çözülmüş metin** saklanabilsin (tarihsel doğruluk; mevcut `expandedStepsSnapshot` ile aynı felsefe).
- **Call to Test** ile birleşim: çağıran veya çağrılan tarafta tanımlı parametrelerin **birleşim ve öncelik** kuralları net olsun.

Non-hedefler (ilk faz): otomasyon framework’e parametre aktarımı, bulk CSV import, çoklu dil bazlı ayrı dataset.

## 2. Referans modeller (kısa)

| Kaynak | Fikir |
|--------|--------|
| Xray | Test adımlarında `${param}`; Dataset satırları; execution’da satır seçimi |
| Azure DevOps | Shared Parameters + test case’e bağlama; adımlarda @param benzeri kullanım |
| HP ALM | Test instance / parametre seti (ürünümüzde “run anı seçimi” ile yaklaşılabilir) |

## 3. Önerilen veri modeli

### 3.1 Test case `custom_fields` (yeni alanlar)

Öneri: `test_steps_json` dizisini bozmadan yanında ek alanlar.

- **`test_param_defs_json`** (opsiyonel): parametre şeması  
  - Örnek: `[{ "name": "username", "label": "Kullanıcı", "default": "demo@x.com" }]`  
  - `name`: yer tutucu anahtarı (`${username}` ile eşleşir); `label`: UI; `default`: tek satırlık çalıştırmada varsayılan.

- **`test_param_rows_json`** (opsiyonel): veri satırları (dataset)  
  - Örnek: `[{ "username": "a@x.com", "amount": "100" }, { "username": "b@x.com", "amount": "200" }]`  
  - Anahtarlar `test_param_defs_json` içindeki `name` ile uyumlu olmalı (validasyon).

Alternatif (daha minimal): tek obje `test_params_json: { defs: [...], rows: [...] }` — tek PATCH ile güncellenir, tercih edilebilir.

### 3.2 Adım metinleri

- `name`, `description`, `expectedResult` içinde **ham şablon** saklanır: örn. `Login as ${username}`.
- Parse/serialize (`testPlan.ts`) aynı kalır; yeni alanlar ayrı custom field.

### 3.3 Yer tutucu sözdizimi (öneri)

- Biçim: **`${paramName}`**  
  - `paramName`: `[a-zA-Z_][a-zA-Z0-9_]*` (regex ile doğrula).  
  - Kaçış ihtiyacı: ilk fazda `{{` literal ihtiyacı yoksa basit tutulur; gerekirse ileride `\${...}` veya `{{literal}}` eklenebilir.

## 4. Çözümleme (substitution) kuralları

- **Girdi:** şablon string + `Record<string, string>` (seçilen satır + default’larla birleşik map).
- **Eksik anahtar:**  
  - **Editör / önizleme:** uyarı rozeti + ham `${name}` bırak veya boş string — ürün kararı; öneri: ham bırak + sarı uyarı.  
  - **Execution save:** ya blokla (eksik parametreyle kaydetme) ya da kaydet ve `unresolvedPlaceholders` metadata — öneri: kayıt öncesi blokla.
- **Fonksiyon:** `applyTestParams(template: string, values: Record<string, string>): string` — saf, test edilebilir modül (`frontend/src/features/quality/lib/`).

## 5. Call to Test ile etkileşim

Genişletilmiş plan üretilirken (`expandTestPlan`):

1. **Kök** test case’in `defs + seçilen row` → üst seviye `values` map’i.
2. Her **call** için: çağrılan artifact’tan `defs` ve (ileride) call satırına özel override okunabilir.  
   - **Faz 1 önerisi:** Sadece **birleşik map**: çağıranın satır değerleri + çağrılanın default’ları; çakışmada **çağıran kazanır** (explicit).  
   - **Faz 2:** Call satırında `paramOverrides?: Record<string, string>` (JSON’da `call` objesine opsiyonel alan).

Çağrılan test case’in kendi `test_param_rows_json` içeriği, kök run’da otomatik seçilmez; kullanıcı tek “aktif satır” ile kökten beslenir (karmaşıklığı düşürür). İleride “nested row” istenirse ayrı iş kuralı yazılır.

## 6. Execution (manuel run) ve kalıcılık

- **Run başlatma / test seçimi:** Player, ilgili test case için `rows` varsa satır seçici (dropdown) gösterir; yoksa `defs` default’larından tek map üretir.
- **Gösterim:** Adımlarda **çözülmüş** metin; isteğe bağlı “şablonu göster” toggle (QA için).
- **`run_metrics_json`:**  
  - Mevcut `expandedStepsSnapshot` gibi, koşu anı için **`resolvedStepsSnapshot`** veya mevcut snapshot içinde adımların zaten çözülmüş halinin yazılması (genişletme + parametre uygulama sırası: önce call expand, sonra tek pass’ta `${}` replace).  
  - Ek metadata (opsiyonel): `paramRowIndex`, `paramValuesUsed: Record<string, string>` — raporlama ve replay.

## 7. UI kapsamı

| Alan | İş |
|------|-----|
| Quality artifact modal / `TestStepsEditor` | Adım alanlarında `${...}` vurgulama (basit regex highlight); “Parametreler” sekmesi veya alt panel: defs tablosu + rows tablosu (inline grid) |
| `QualityTestCaseDetailPanels` | Tanımlı parametreler ve satır sayısı özeti |
| `ManualExecutionPlayerCore` | Satır seçici; expand + substitute sonrası liste; kayıtta snapshot |
| i18n | Yeni stringler `quality.ts` |

## 8. Backend

- İlk fazda **sadece custom field JSON** olarak saklama yeterli; ayrı tablo şart değil.
- İstenirse: artifact PATCH validasyonu — `test_param_defs_json` / `test_param_rows_json` şema kontrolü (Pydantic) ve `name` benzersizliği.
- Arama/indeks: ilk fazda gerek yok.

## 9. Uygulama fazları

**Faz A — Çekirdek**

- `test_params_json` (veya ayrı iki alan) tipi + parse/normalize + artifact modal’da defs + tek satır (rows olmadan sadece default’lar).
- `applyTestParams` + unit testler.
- Player’da çözülmüş adımlar; run kaydında çözülmüş snapshot.

**Faz B — Dataset**

- `rows` CRUD UI; satır seçimi player’da.
- Eksik anahtar validasyonu ve kayıt metadata’sı.

**Faz C — Call to Test entegrasyonu**

- `expandTestPlan` sonrası veya expand içinde parametre map’inin iletilmesi; çakışma kuralı (çağıran öncelikli).
- Opsiyonel: `call` satırında `paramOverrides`.

## 10. Geriye dönük uyumluluk

- Parametre alanları yoksa davranış bugünkü gibi: substitution yapılmaz.
- Mevcut `test_steps_json` satırları `${}` içermeyebilir; değişiklik gerekmez.

## 11. Kabul kriterleri (MVP = Faz A + B özü)

- En az iki parametre tanımlanıp adımlarda kullanılabilir.
- En az iki veri satırı tanımlanıp run’da seçilebilir; kaydedilen run’da çözülmüş metin okunabilir.
- Call to Test ile birleşik senaryoda (Faz C sonrası) tek aktif satırla çağrılan adımların da doğru çözüldüğü manuel test senaryosu + tercihen e2e.

## 12. Riskler

- Şablon sözdizimi ile gelecekte “fonksiyon” isteği (tarih, rastgele) — ilk fazda yalnızca düz değişken.
- Çok büyük dataset’lerde UI performansı — sayfalama veya satır limiti (ör. 500) dokümante edilebilir.

---

**İlgili mevcut kod:** `test_steps_json` (`testPlan.ts`), `expandedStepsSnapshot` (`runMetrics.ts`), `ManualExecutionPlayerCore.tsx`, `TestStepsEditor.tsx`, Call to Test (`kind: "call"`).
