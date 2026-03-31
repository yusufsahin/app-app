# Test case parametreleri — kullanım kılavuzu

Bu doküman, üründe **test case** düzenlerken parametreleri nasıl tanımlayıp **adım metinlerinde** nasıl kullanacağınızı anlatır. Teknik plan ve veri modeli: [QUALITY_PARAMETRIZATION_PLAN.md](./QUALITY_PARAMETRIZATION_PLAN.md).

## Parametre nerede saklanır?

Test case artifact’ında `custom_fields` altında **`test_params_json`** alanı kullanılır:

- **`defs`**: Parametre tanımları (`name`, `label`, `default`, opsiyonel `type`, `required`, `allowedValues`).
- **`rows`** (opsiyonel): İsimli **configuration** kayıtları. Her satır stable `id` taşır; opsiyonel `name`, `label`, `isDefault`, `status`, `tags` ve `values` alanları içerir.

Bunu test case düzenleme modalında **Parameters** bölümü yönetir (`QualityTestParamsEditor`).

## Adımlarda kullanım (yer tutucular)

### Hangi alanlarda?

**Normal manuel adımlarda** (satır tipi “step”), aşağıdaki üç metin alanında yer tutucu yazabilirsiniz:

- **Action** (adım adı / eylem)
- **Description**
- **Expected result**

**Call to test** satırlarında (`kind: "call"`) bu yer tutucular için plan içi tarama yapılmaz; çağrılan test case kendi parametreleri ve genişletilmiş planıyla çalışır.

### Sözdizimi

- Biçim: **`${paramName}`**
- `paramName` kuralları (kod ile uyumlu): `[a-zA-Z_][a-zA-Z0-9_]*`  
  - Örnek: `${user}`, `${baseUrl}`, `${_env}` geçerlidir.  
  - Rakamla başlayan veya boşluklu isim kullanılamaz.

Örnek:

| Action | Description |
|--------|-------------|
| `Log in as ${user}` | `Open login page and enter ${user}` |
| `Verify profile` | `Header shows ${user}` |

### Tanımlı olmayan veya eksik değer

- **`defs`** içinde tanımlı bir `name` yoksa veya çalıştırma sırasında değer map’inde yoksa, substitution yapılmaz; metinde **`${paramName}`** olduğu gibi kalabilir.
- Kayıt öncesi çözümleme kontrolleri (manuel çalıştırma) eksik yer tutuculara göre uyarı veya bloklama üretir (ürün davranışı).

## Parameters paneli (defs + configurations)

1. **Add parameter** ile yeni satır ekleyin.
2. **NAME**: Yer tutucudaki `paramName` ile **birebir** aynı olmalı (`${user}` → NAME `user`).
3. **LABEL**: Formda gösterim (isteğe bağlı).
4. **DEFAULT**: Veri satırı seçilmediğinde veya hücre boşsa kullanılan varsayılan string.
5. **Add configuration** ile isimli configuration ekleyin; her configuration kendi stable `id`’siyle saklanır ve hücreler parametre adına göre doldurulur.

İsim alanını düzenlerken odak kaybı yaşanmaması için satırlar stabil anahtarlarla listelenir; isim değişince satırdaki `values` anahtarları güncellenir.

## Manuel çalıştırma (run player)

1. Test case’te **configuration rows** varsa player’da bir **configuration** seçilir; yoksa yalnızca **default** değerler kullanılır.
2. Execution çözümleme backend tarafından yapılır. Pratik sıra: parametre default’ları, seçilen configuration değerleri ve `call` satırlarındaki `paramOverrides` birlikte değerlendirilir; kayda geçen sonuç authoritative backend çözümüdür.

Çağrılan test case’in kendi configuration rows yapısı kök run’da ayrıca seçilmez; backend root context + call override’ları kullanarak tek resolved execution config üretir.

## Call to test satırında `paramOverrides`

Bir call satırında JSON ile **çağrı anı override** verebilirsiniz (editörde ilgili alan). Bunlar genişletilmiş plan ve parametre birleşimine göre çözülmüş adımlara uygulanır.

## İlgili kod

| Konu | Dosya |
|------|--------|
| Parse / normalize / substitution | `frontend/src/features/quality/lib/testParams.ts` |
| Plan içinde hangi `${...}` sayılıyor | `extractReferencedParamNamesFromPlan` (yalnızca normal adımlar) |
| Parameters UI | `frontend/src/features/quality/components/QualityTestParamsEditor.tsx` |
| Modal’da `test_params_json` | `frontend/src/shared/modal/modals/QualityArtifactModal.tsx` |
| Backend-owned resolution | `backend/src/alm/quality/application/queries/resolve_test_execution_config.py` |
| Manuel run + configuration seçimi | `frontend/src/features/quality/components/ManualExecutionPlayerCore.tsx` |

## İngilizce UI ipucu

Kısa metin: `frontend/src/i18n/locales/en/quality.ts` içinde `params.emptyHint` — adım metninde `${placeholders}` ve dataset ile ilişkiyi özetler.
