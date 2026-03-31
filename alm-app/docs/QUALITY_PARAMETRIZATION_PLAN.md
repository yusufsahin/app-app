# Quality: Test case parametrizasyonu — ürün ve teknik plan

**Kullanım (adımlarda `${...}` nasıl yazılır):** [QUALITY_TEST_PARAMS_USER_GUIDE.md](./QUALITY_TEST_PARAMS_USER_GUIDE.md)

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

## 3. Mevcut production-grade veri modeli

### 3.1 Test case `custom_fields`

Tek authoritative alan:

- **`test_params_json`**  
  - Şekil: `{
      "v": 2,
      "defs": [{ "name": "...", "label": "...", "default": "...", "type": "string", "required": false, "allowedValues": [] }],
      "rows": [{ "id": "cfg-...", "name": "staging_qa", "label": "Staging QA", "values": { ... }, "isDefault": true, "status": "active", "tags": [] }]
    }`
  - Ürün dili: her `row` bir **configuration** olarak gösterilir.
  - `id` alanı reorder/delete sonrası geçmiş run görünümünü koruyan stable identity’dir.

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
- Çözümleme artık backend-owned olmalı; frontend yalnızca configuration seçimi ve sonuç görüntüleme yapar.

## 5. Call to Test ile etkileşim

Genişletilmiş plan backend’de çözülür:

1. Kök test case’in default + seçilen configuration değerleri alınır.
2. Her `call` satırında çağrılan testin default’ları ve `paramOverrides` uygulanır.
3. Invalid override key, circular call ve eksik artifact durumları typed error üretir.

## 6. Execution (manuel run) ve kalıcılık

- **Run başlatma / test seçimi:** Player, ilgili test case için configuration seçici (dropdown) gösterir; yoksa `defs` default’larından tek map üretir.
- **Gösterim:** Adımlarda **çözülmüş** metin; isteğe bağlı “şablonu göster” toggle (QA için).
- **`run_metrics_json`:**  
  - Güncel payload `v: 2` altında configuration-aware çalışır.
  - Her result için `configurationId`, `configurationName`, `configurationSnapshot`, `resolvedValues`, `expandedStepsSnapshot` saklanır.
  - Legacy `paramRowIndex` ve `paramValuesUsed` yalnızca read-compat amaçlı düşünülebilir.

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

## 9. Uygulanan yön

- V2 `test_params_json` schema
- stable configuration IDs
- backend execution resolution endpoint
- V2 `run_metrics_json`
- configuration-first UI terminology

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
