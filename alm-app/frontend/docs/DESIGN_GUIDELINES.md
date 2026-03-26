# Design Guidelines (Definedatamodelcopy uyarlaması)

Bu doküman alm-app frontend’in **Definedatamodelcopy** tasarım sistemiyle uyumlu kullanım kurallarını özetler.

## Tema

- **Primary:** `#2563eb`
- **Secondary:** `#8b5cf6`
- **Success:** `#10b981`
- **Error:** `#ef4444`
- **Warning:** `#f59e0b`
- **Border radius:** 12px (genel), butonlarda 8px
- **Tipografi:** `theme.ts` içinde tanımlı (h4 sayfa başlığı, body2 açıklama)

## Bileşen kuralları

### Buton

- **Primary:** Bölümün ana aksiyonu; bölüm başına tek primary buton.
- **Secondary (outlined):** Alternatif veya yardımcı aksiyonlar.
- **Tertiary (text):** Daha az vurgulu aksiyonlar.
- MUI: `textTransform: "none"`, `fontWeight: 600`, `borderRadius: 8`.

### Chip

- Chip’ler set halinde (3 veya daha fazla) kullanılabilir.
- `fontWeight: 500` (theme override).

### Kart / Paper

- Kart gölgesi: `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`.
- `borderRadius: 12`.

## Sayfa yapısı

- Sayfa başlığı: `Typography variant="h4"`.
- Açıklama: `body2` + `text.secondary`.
- `StandardPageLayout` kullan; boş/yükleme durumları için `EmptyState` / `LoadingState`.

## Toast (bildirim)

- **notistack** kullanılır.
- Konum: sağ üst (`top`, `right`).
- En fazla 3 snack aynı anda.
- Otomatik kapanma: 3 saniye.
- Uygulama içi API: `useNotificationStore().showNotification(message, severity)` (store notistack’e bridge edilir).

## Board (Kanban)

- **react-dnd** + **HTML5Backend** ile sürükle-bırak.
- Board sayfası `DndProvider` ile sarılıdır; kolon/kart mantığı mevcut native HTML5 drag ile uyumludur.

## CSS / Tailwind

- **Tailwind v4** + `src/styles/theme.css` ile CSS değişkenleri ve utility sınıfları kullanılabilir.
- `tw-animate-css` animasyonlar için mevcuttur.
- Tema değişkenleri MUI paleti ile hizalıdır (`--primary`, `--secondary`, `--background`, vb.).

## Referans

- Kaynak şablon: Definedatamodelcopy (`theme.css`, `Layout`, `Guidelines.md`).
- Uyarlama planı: `definedatamodelcopy_alm-app_uyarlama_96c1b37d.plan.md`.
