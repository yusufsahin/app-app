# Figma tasarımı için uygulama bilgileri

Tasarımcıya verilebilecek özet doküman aşağıdadır. İstersen bunu kopyalayıp Figma brief'i veya Notion/Confluence sayfası olarak kullanabilirsin.

---

## 1. Ürün tanımı

**ALM (Application Lifecycle Management)**  
Organizasyonlar, projeler ve manifest tabanlı iş öğesi (requirement, defect, task, epic, issue) yönetimi. Workflow durumlarına göre geçiş (ör. new → active → resolved → closed), atama, planlama (cycle/area), otomasyon ve süreç manifest'i (workflow/artifact type) yönetimi.

**Hedef kullanıcı:** Takım liderleri, geliştiriciler, proje yöneticileri; çok kiracılı (tenant), org ve proje bazlı erişim.

---

## 2. Sayfa ve URL yapısı

URL şeması: `/{orgSlug}` ve `/{orgSlug}/{projectSlug}/...` (Azure DevOps tarzı).

| Sayfa | URL (org/project örnek) | Açıklama |
|-------|-------------------------|----------|
| Giriş | `/login` | E-posta/şifre, "Register" linki |
| Kayıt | `/register` | Kayıt formu, "Login" linki |
| Tenant seçimi | `/select-tenant` | Birden fazla org varsa seçim |
| Projeler listesi | `/{org}` | Org'a ait projeler, proje kartları |
| Dashboard | `/{org}/dashboard` | Org geneli özet |
| Proje özeti | `/{org}/{project}` | Tek proje overview, "Back to project" |
| Planlama | `/{org}/{project}/planning` | Cycle/area ağaçları, planlama görünümü |
| Artifacts (liste) | `/{org}/{project}/artifacts` | Filtre, arama, DataGrid, "New work item" |
| Board | `/{org}/{project}/board` | Kanban: sütunlar = workflow state, sürükle-bırak kartlar |
| Otomasyon | `/{org}/{project}/automation` | Otomasyon kuralları |
| Process manifest (proje) | `/{org}/{project}/manifest` | Workflow/artifact type editörü (JSON/YAML, Overview/Preview) |
| Organization Settings | `/{org}/settings` | Alt sayfalar: Overview, Members, Roles, Privileges, Process manifest (liste), Access audit |
| No access | `/{org}/no-access` | Yetkisiz erişim mesajı |
| 404 | `*` | "Page not found" + "Go to Dashboard" |

---

## 3. Ana layout ve navigasyon

- **Sol sidebar (drawer):** Daraltılabilir (72px / 240px). Org seviyesinde: Projects, Dashboard. Proje seçiliyken: Overview, Planning, Artifacts, Board, Automation.
- **Üst:** AppBar: proje switcher (dropdown), arama, bildirim, dark/light mode, kullanıcı menüsü (avatar) – logout, tenant switch.
- **İçerik:** Breadcrumb (örn. demo / Az Basic / Artifacts), sayfa başlığı, ana içerik alanı.
- **Command palette:** Kısayol ile açılan arama (projeler, sayfalar).

Nav öğeleri ve ikonlar (MUI ikonları): Folder, Dashboard, FolderOpen, CalendarMonth, ViewList, ViewColumn, AutoAwesome, Settings, History, AccountTree.

---

## 4. Önemli ekranlar ve bileşenler

- **Artifacts:** Arama, filtreler (type, cycle, area, state), Export CSV, Members, "+ New work item" butonu; liste (DataGrid) veya drawer ile detay.
- **Board:** Yatay kaydırmalı sütunlar (her biri workflow state: new, active, resolved, closed vb.), her sütunda kartlar; sürükle-bırak; kartta key, tip, başlık, atanan, state chip.
- **Manifest sayfası:** Tab'lar (Overview, Preview, Source, Workflow); Overview'da workflow/artifact type yönetimi; Source'da JSON/YAML editör; Save.
- **Auth:** Login/Register formları (e-posta, şifre, tenant seçimi); "Forgot password" yok (şu an).
- **Proje detay:** Proje bilgisi, hızlı linkler (Artifacts, Board, Planning, Manifest).

---

## 5. Tasarım sistemi (mevcut – Figma'da kullanılabilir)

**Font:** Inter, sans-serif.

**Tipografi (MUI uyumlu):**
- h1: 48px, weight 600, line-height 1.2
- h2: 36px, weight 600
- h3: 30px
- h4: 24px, weight 600
- h5: 20px, weight 600
- h6: 18px, weight 600
- subtitle1: 18px
- subtitle2: 14px, weight 500
- body1/body2: 14px
- caption: 12px

**Renk paleti (HSL):**  
- **Brand (primary):** 50–900, ana mavi ~hsl(210, 98%, 48%) (400)  
- **Gray (nötr):** 50–900, arka plan/text  
- **Green (success):** 50–900  
- **Orange (warning):** 50–900  
- **Red (error):** 50–900  

Light mode: background default #fafafa benzeri, paper hafif gri-mavi. Dark mode: background gray 900, paper ~hsl(220, 30%, 7%).

**Şekil:** Border radius 8px (varsayılan).  
**Gölge:** Light: hafif gri gölge; dark: daha koyu, daha belirgin.

Detaylar: [frontend/src/app/theme/themePrimitives.ts](../frontend/src/app/theme/themePrimitives.ts)

---

## 6. Teknik bağlam (handoff için)

- **UI kütüphanesi:** Material UI (MUI) v5+, React 18.
- **Yönlendirme:** React Router 6; path'ler yukarıdaki tabloya göre.
- **Responsive:** `md` breakpoint ile drawer; mobilde menü kapatılır/açılır.
- **Dark/Light:** Sistem/manuel seçim; CSS değişkenleri ve MUI theme (palette.mode).

Tasarımcı MUI grid/layout (Container, Box, Stack, Grid) ve 8px tabanlı spacing ile uyumlu tasarlayabilir.

---

## 7. Önerilen Figma çıktıları

1. **Design system frame:** Renk, tipografi, spacing, radius, shadow (light/dark).
2. **Sayfa tasarımları:** Login, Register, Tenant select, Projects list, Dashboard, Project overview, Artifacts (liste + toolbar), Board (kanban), Planning, Manifest (Overview + Source), Settings (alt sayfalar).
3. **Bileşen seti:** Buton, input, select, chip, kart, data grid örnek satır, drawer, app bar, sidebar nav.
4. **Akışlar:** Login → Tenant → Projects → Artifacts; Project → Board (drag); Create artifact modal.

Bu dokümanı Figma brief'e yapıştırıp ekran listesi ve akışları birlikte paylaşabilirsin. Eksik bırakmak istediğin sayfa/akış varsa söylemen yeterli.
