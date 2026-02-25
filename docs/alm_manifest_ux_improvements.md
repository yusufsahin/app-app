# ALM Manifest UX — Plan İyileştirme Önerileri

Bu doküman [alm_manifest_ux_plan_4e61a2f7.plan.md](../.cursor/plans/alm_manifest_ux_plan_4e61a2f7.plan.md) ile birlikte okunmalı; plandaki hedeflere ek olarak **daha iyi ne yapabiliriz** sorusuna yanıt verir.

---

## Uygulama durumu

| Bölüm | Durum | Not |
|-------|--------|-----|
| **1.1** URL–store senkron | ✅ | AppLayout’ta `useEffect` ile `projectSlug` + `projects` → `setCurrentProject` / `setLastVisitedProjectSlug` |
| **1.2** Son kullanılan proje | ✅ | `projectStore.lastVisitedProjectSlug` + localStorage; Dashboard varsayılan seçim |
| **1.3** Klavye / aria | ✅ | Switcher’da `aria-label`, `aria-expanded`, `aria-haspopup` var; MUI Menu ok tuşları destekliyor |
| **1.4** Boş / yükleme | ✅ | Switcher’da Loading…; proje yokken “No projects” + “Go to projects” butonu; Dashboard’da proje seçici Loading… ve boşta disabled |
| **2** Proje menüsü sidebar | ✅ | `PROJECT_NAV_ITEMS` (Overview, Manifest, Planning, Artifacts, Board, Automation); collapsed tooltip; izin filtre |
| **3** Dashboard proje seçimi | ✅ | Başlık yanında proje dropdown; lastVisited varsayılan; stat kartları seçilen projeye link; yükleme/boş state |
| **4** Breadcrumb / Back | ✅ | Ortak `ProjectBreadcrumbs`; tüm proje sayfalarında kullanılıyor; “Back to project” tek anlam |
| **5.1** Mobil drawer | ✅ | Aynı drawerContent (Switcher + proje nav) mobilde de kullanılıyor |
| **5.2** Deep link | ✅ | URL’den proje; layout’ta store senkronu |
| **5.3** 404 / erişim | ✅ | Ortak `ProjectNotFoundView`; tüm proje sayfaları + Manifest 403 |
| **6** Favori projeler | ✅ | Project Switcher’da pin (yıldız); org bazlı localStorage; en fazla 8 pin |
| **6** Ctrl+K palette | ✅ | CommandPalette; arama + ok tuşu + Enter ile hızlı sayfa geçişi |
| **6** Arama scope | ✅ | Arama scope (header’da “Search in project”) Proje rotasinda placeholder "Search artifacts…"; Artifacts sayfasinda ?q= ile header/toolbar senkron. |

**Kullanılan bileşenler:** `shared/components/Layout` (barrel: `AppLayout`, `ProjectSwitcher`, `ProjectBreadcrumbs`, `ProjectNotFoundView`, `RequirePermission`, `ProtectedRoute`); `projectStore.ts` (`lastVisitedProjectSlug`); `DashboardPage.tsx` (proje seçici).

**Yapılan değişiklikler (özet):**
- Proje rotasında URL → store senkronu; `lastVisitedProjectSlug` + localStorage.
- Sidebar’da Project Switcher (dropdown) ve proje menüsü (Overview, Manifest, Planning, Artifacts, Board, Automation); pin (favori) projeler.
- Dashboard’da proje seçici (varsayılan: son proje); stat kartları seçilen projeye link; yükleme/boş durumda “No projects yet — Go to projects”.
- Tüm proje sayfalarında ortak `ProjectBreadcrumbs` ve “Back to project”; ortak `ProjectNotFoundView` (proje yok / 403).
- Layout bileşenleri `shared/components/Layout` barrel’inden import edilebilir.
- **Ctrl+K** (veya Cmd+K): Command palette — sayfa adına göre arama, ok tuşu + Enter ile geçiş; Organization settings ve Access audit (yetkiye göre) dahil. Header’da chip ile ipucu (Mac’te ⌘K, diğerinde Ctrl+K).
- Arama scope: proje rotasinda placeholder "Search artifacts…"; Artifacts sayfasinda ?q= ile header/toolbar senkron.
- 1.3 Klavye/aria: Project Switcher kapaninca focus tetikleyici butona dönüyor (requestAnimationFrame ile).
- 3.3 Recent activity: "Show only selected project" checkbox (Dashboard; seçilen projeye gore client-side filtre).

---

## 1. Proje Bağlamı ve Project Switcher — İyileştirmeler

### 1.1 URL ile senkron proje
- **Sorun:** `projectSlug` URL’de var ama `useProjectStore.currentProject` her sayfada (ProjectDetail, Board, Artifacts vb.) ayrı ayrı set ediliyor; bazen sadece `projects?.find(p => p.slug === projectSlug)` ile türetiliyor.
- **Öneri:** Proje rotasına girildiğinde (`/:orgSlug/:projectSlug/...`) tek bir yerde (örn. layout veya route wrapper) `projectSlug` + `useOrgProjects(orgSlug)` ile projeyi bulup `setCurrentProject(project)` yapın. Böylece Project Switcher ve “son kullanılan proje” her zaman doğru projeyi kullanır.

### 1.2 “Son kullanılan proje” kalıcılığı
- **Plan:** Dashboard’da “last visited project” isteğe bağlı denmişti.
- **İyileştirme:** `projectStore`’a `lastVisitedProjectSlug: string | null` ekleyin (ve isteğe bağlı `localStorage` ile persist edin). Proje sayfasından çıkarken veya proje değiştirirken güncelleyin. Dashboard ve Project Switcher’da “son proje” varsayılan seçenek olsun; böylece tek projede çalışan kullanıcı her seferinde seçim yapmak zorunda kalmaz.

### 1.3 Klavye ve erişilebilirlik
- Project Switcher dropdown açıkken **arrow keys** ile proje listesinde gezinme.
- **aria-label** / **aria-expanded** ve proje seçildiğinde focus yönetimi (dropdown kapanınca focus “Şu anki proje” butonunda kalsın).

### 1.4 Boş / yükleme durumları
- Proje listesi yüklenirken: Switcher’da skeleton veya “Loading…”.
- Hiç proje yokken: “No projects — Create one” + Projects sayfasına link (org switcher’daki “New organization” pattern’ine benzer).

---

## 2. Sidebar Proje Menüsü — İyileştirmeler

### 2.1 Tek kaynak (single source of truth)
- **Öneri:** Proje-scoped route’ları ve izinleri tek yerde tanımlayın. Örn. `PROJECT_NAV_ITEMS` (path, label, icon, permission) — router’daki path ve permission’lar ile eşleşsin. Böylece yeni proje sayfası eklerken sadece bu listeye eklemeniz yeterli olur; router zaten mevcut.

### 2.2 Collapsed sidebar’da proje menüsü
- Sidebar collapse edildiğinde proje grubu sadece ikonlarla görünsün; tooltip’te “Manifest”, “Board” vb. olsun. Mevcut org nav’daki `title={isCollapsed ? item.label : undefined}` pattern’i proje öğelerine de uygulanabilir.

### 2.3 Proje özeti linki
- Proje menüsünün ilk öğesi “Project overview” / “Summary” olsun → `/:orgSlug/:projectSlug` (ProjectDetailPage). Böylece “Back to project” ile aynı hedef sidebar’dan da tek tıkla erişilir; tutarlılık artar.

### 2.4 İzin yoksa gizle
- Kullanıcıda bir proje sayfası için izin yoksa (örn. `manifest:read` yok) o menü öğesini göstermeyin. Planla uyumlu; `hasPermission` ile filtreleyin.

---

## 3. Dashboard ve Proje Seçimi — İyileştirmeler

### 3.1 Proje seçici yerleşimi
- Dropdown’ı sayfa başlığının yanına veya stat kartlarının hemen üstüne koyun; “Dashboard — [Proje: Acme ▼]” gibi. Proje seçilmeden (ve proje yokken) kartlar tıklanabilir olmasın veya “Select a project to view stats” mesajı gösterin.

### 3.2 İstatistik kapsamı
- **Mevcut:** `useOrgDashboardStats(orgSlug)` org seviyesinde. Eğer backend proje bazlı istatistik sunuyorsa, Dashboard’da seçilen projeye göre **proje bazlı** Artifacts/Tasks/Open Defects sayılarını göstermek daha anlamlı olur (kartlar o projenin artifact sayfalarına gider).
- Backend sadece org toplamı veriyorsa: Kartlar yine “seçilen projeye git” ile aynı projede Artifacts/Tasks/Open Defects sayfalarına gidebilir; sayı org toplamı olarak kalır, davranış netleşir.

### 3.3 Recent activity
- “Recent activity” listesinde zaten proje bazlı link var. Seçilen projeyi (veya “last visited”) varsayılan filtre olarak kullanmak isteğe bağlı; çok proje varsa “Show only current project” filtresi eklenebilir.

---

## 4. Breadcrumb ve “Back” — İyileştirmeler

### 4.1 Ortak bileşen
- **Öneri:** `ProjectPageFrame` veya `ProjectBreadcrumbs` gibi bir bileşen: Org → Project → [Sayfa adı], + “Back to project” butonu. Manifest, Planning, Artifacts, Board, Automation bu bileşeni kullansın; metin ve linkler tek yerden gelsin, tutarlılık ve bakım kolaylaşır.

### 4.2 Breadcrumb’da proje adı
- Proje adı için `project?.name ?? projectSlug` kullanılıyor; proje henüz yüklenmemişse `projectSlug` gösterilir. İsterseniz proje yüklenene kadar breadcrumb’da kısa skeleton veya sadece slug gösterin; yükleme bitince name’e geçin.

### 4.3 “Back to project” tek anlam
- Planla uyumlu: “Back to project” her zaman `/:orgSlug/:projectSlug` (ProjectDetailPage). Bunu ortak bileşende sabitlerseniz, gelecekte yanlışlıkla “Back to projects list”e dönme riski kalmaz.

---

## 5. Genel UX ve Teknik Tutarlılık

### 5.1 Mobil (drawer)
- Proje menüsü ve Project Switcher mobil drawer’da da görünsün. Drawer açıldığında proje bağlamındaysa önce org, sonra proje switcher, sonra proje nav öğeleri aynı sırayla listelensin; kapatma sonrası hangi sayfada olduğu header’dan (ve varsa breadcrumb’dan) anlaşılsın.

### 5.2 Deep link ve yenileme
- Kullanıcı `/:orgSlug/:projectSlug/board` gibi bir URL’i yenilediğinde veya paylaştığında proje bilgisi sadece URL’den gelmeli; store’a layout/route tarafında set edildiği için (1.1) Project Switcher ve sidebar doğru projeyi gösterir. Bu senaryoyu plana “Deep link: sayfa yenileme ve paylaşım URL’leri doğru çalışmalı” diye not edin.

### 5.3 404 / erişim yok
- `projectSlug` URL’de var ama proje bulunamadığında (silinmiş veya yetkisiz): “Project not found” veya “You don’t have access” mesajı + “Back to projects” butonu. Bu davranışı tek bir yerde (örn. proje route wrapper) ele alın.

---

## 6. Opsiyonel / İleri Aşama

- **Favori / pin projeler:** Switcher’da “Pinned” bölümü; sık kullanılan 2–3 proje üstte listelensin (localStorage veya backend).
- **Global arama:** Header’daki “Search projects” proje sayfasındayken “Search artifacts” veya “Search in project” olarak genişletilebilir; scope’a göre sonuçlar filtrelenir.
- **Kısayollar:** Örn. `Ctrl+K` → proje veya sayfa atlama (Command palette) ileride eklenebilir.

---

## 7. Özet Tablo (Plan + İyileştirmeler)

| Öncelik | Konu | Plandaki hedef | Ek iyileştirme |
|--------|------|-----------------|----------------|
| 1 | Project Switcher | Proje dropdown; aynı sayfa tipi yeni projede | URL–store senkron; lastVisited persist; klavye/aria; boş/yükleme state |
| 2 | Proje menüsü sidebar | Manifest, Planning, Artifacts, Board, Automation sidebar’da | Tek config (PROJECT_NAV_ITEMS); collapsed tooltip; “Project overview” ilk öğe; izin filtre |
| 3 | Dashboard proje seçimi | Proje seçici; kartlar seçilen projeye link | Seçici yerleşimi; proje bazlı stat (backend varsa); recent activity filtre (opsiyonel) |
| 4 | Breadcrumb/Back | Tüm proje sayfalarında aynı pattern | Ortak ProjectPageFrame/ProjectBreadcrumbs; proje adı yükleme; “Back” tek anlam |
| — | Genel | — | Mobil drawer; deep link/yenileme; 404/erişim; ileride favori projeler, arama scope |

Bu iyileştirmeler planı bozmadan uygulanabilir; isterseniz önce 1–4’ü bitirip sonra “Genel” ve “İleri aşama”yı iteratif ekleyebilirsiniz.
