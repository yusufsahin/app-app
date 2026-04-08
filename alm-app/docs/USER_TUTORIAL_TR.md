# ALM Kullanıcı Kılavuzu

**Sürüm:** 1.0 &nbsp;|&nbsp; **Güncelleme:** Nisan 2026 &nbsp;|&nbsp; **Demo:** https://demo.pamera.app.provera.net.tr

---

## Bu Kılavuz Hakkında

ALM (Application Lifecycle Management), yazılım projelerinin tüm yaşam döngüsünü — gereksinim analizinden test yönetimine, sprint planlamasından dağıtım izlenebilirliğine — tek bir platformda yönetmenizi sağlar.

Bu kılavuz; platforma yeni başlayanlar için temel kavramları, deneyimli kullanıcılar için ise günlük iş akışlarını adım adım açıklar.

> **Demo ortamı:** Demo ortamına `admin@example.com` / `Admin123!` ile giriş yaparak tüm özellikleri canlı deneyebilirsiniz. Demo organizasyonunda iki hazır proje bulunur: **Sample Project** (`SAMP`) ve **Unima** (`UNIMA`).

---

## İçindekiler

- [Rolüme Göre Nereden Başlamalıyım?](#rolüme-göre-nereden-başlamalıyım)
- [Temel Kavramlar](#temel-kavramlar)
- [Bölüm 1: Arayüz ve Navigasyon](#bölüm-1-arayüz-ve-navigasyon)
- [Bölüm 2: Giriş ve Organizasyon Yönetimi](#bölüm-2-giriş-ve-organizasyon-yönetimi)
- [Bölüm 3: Proje Kurulumu](#bölüm-3-proje-kurulumu)
- [Bölüm 4: Backlog ve İş Kalemleri](#bölüm-4-backlog-ve-iş-kalemleri)
- [Bölüm 5: İş Kalemi Detay Paneli](#bölüm-5-iş-kalemi-detay-paneli)
- [Bölüm 6: Kalite ve Test Yönetimi](#bölüm-6-kalite-ve-test-yönetimi)
- [Bölüm 7: Board ve Kanban](#bölüm-7-board-ve-kanban)
- [Bölüm 8: Planlama, Sprint ve Sürüm](#bölüm-8-planlama-sprint-ve-sürüm)
- [Bölüm 9: İzlenebilirlik ve Etki Analizi](#bölüm-9-izlenebilirlik-ve-etki-analizi)
- [Bölüm 10: Otomasyon Kuralları](#bölüm-10-otomasyon-kuralları)
- [Bölüm 11: Üye ve Rol Yönetimi](#bölüm-11-üye-ve-rol-yönetimi)
- [Bölüm 12: Manifest ve Süreç Şablonları](#bölüm-12-manifest-ve-süreç-şablonları)
- [Bölüm 13: Dashboard ve Raporlama](#bölüm-13-dashboard-ve-raporlama)
- [Bölüm 14: Adım Adım İş Akışları](#bölüm-14-adım-adım-iş-akışları)
- [Bölüm 15: Kullanım Senaryoları](#bölüm-15-kullanım-senaryoları)
- [Sık Sorulan Sorular](#sık-sorulan-sorular)
- [Sorun Giderme](#sorun-giderme)
- [Sözlük](#sözlük)
- [Hızlı Başvuru Kartı](#hızlı-başvuru-kartı)

---

## Rolüme Göre Nereden Başlamalıyım?

Zamanınız kısıtlıysa aşağıdan kendi rolünüzü bulun ve ilgili bölümlere atlayın.

### Ben bir Proje Yöneticisi veya Ürün Sahibiyim

Projenizi kurun, gereksinimleri tanımlayın ve ilerlemeyi takip edin.

1. **Proje oluşturun** → [Bölüm 3](#bölüm-3-proje-kurulumu)
2. **Epic ve User Story yazın** → [Bölüm 4: Yeni İş Kalemi](#yeni-iş-kalemi-oluşturma)
3. **Sprint planlayın** → [Bölüm 8](#bölüm-8-planlama-sprint-ve-sürüm)
4. **İlerlemeyi Dashboard'dan izleyin** → [Bölüm 13](#bölüm-13-dashboard-ve-raporlama)

### Ben bir Geliştirici veya Takım Üyesiyim

Günlük işinizi Board üzerinden yönetin.

1. **Üzerinize atanmış işleri görün** → Board'da "Atanan: Ben" filtresi — [Bölüm 7](#bölüm-7-board-ve-kanban)
2. **İş kalemini aktive edin** → kartı `To Do → In Progress` sütununa taşıyın
3. **Commit'lerinizi iş kalemine bağlayın** → [Bölüm 5: Source Sekmesi](#sekme-4-kaynak-kod-source)
4. **Görevi tamamlandı olarak işaretleyin** → [Bölüm 5: Görevler Sekmesi](#sekme-2-görevler-tasks)

### Ben bir Test Uzmanıyım

Test senaryoları oluşturun, kampanya yürütün, hataları kaydedin.

1. **Test senaryosu yazın** → [Bölüm 6: Test Kataloğu](#61-test-katalogu)
2. **Kampanya oluşturun ve çalıştırın** → [Bölüm 6: Kampanya](#62-test-kampanyasi)
3. **Sonuçları girin ve hata açın** → [Bölüm 6: Test Çalıştırma](#63-test-calistirma-test-run)
4. **Kapsama durumunu görün** → [Bölüm 9: İzlenebilirlik](#91-izlenebilirlik-matrisi)

### Ben bir Organizasyon Yöneticisiyim

Erişim kontrolü, roller ve sistem yapılandırması.

1. **Üye davet edin** → [Bölüm 11: Üye Yönetimi](#üye-davet-etme)
2. **Özel rol oluşturun** → [Bölüm 11: Rol Yönetimi](#rol-yönetimi)
3. **Erişim loglarını inceleyin** → [Bölüm 11: Denetim Kaydı](#denetim-kaydi-audit-log)
4. **Süreç şablonu yapılandırın** → [Bölüm 12](#bölüm-12-manifest-ve-süreç-şablonları)

---

## Temel Kavramlar

Bu kavramları bilmek kılavuzun geri kalanını çok daha kolay anlamanızı sağlar.

| Kavram | Açıklama | Örnek |
|--------|----------|-------|
| **Organizasyon (Tenant)** | Şirket veya ekip çapında izole çalışma alanı | "Demo" org |
| **Proje** | Organizasyon altındaki bağımsız iş birimi; kendi backlog'u, board'u ve kalite ağacı vardır | "Sample Project" (`SAMP`) |
| **Artifact / İş Kalemi** | Takip edilen her şey: Epic, User Story, Defect, Task… | `SAMP-42` |
| **Artifact Anahtarı** | Proje kodu + numara; benzersiz ve kalıcı | `SAMP-42` |
| **Manifest** | Projenin "kuralları": hangi iş kalemi türleri var, hangi durumlar ve geçişler izin verilmiş | Scrum şablonu |
| **Workflow / Durum Makinesi** | Bir iş kaleminin geçebileceği durumlar ve aralarındaki geçiş kuralları | `New → Active → Resolved → Closed` |
| **Döngü (Cycle)** | Sprint; belirli tarih aralığındaki iş grubu | "Sprint 3" |
| **Sürüm (Release)** | Teslim edilecek yazılım paketi | "v1.2.0" |
| **Alan (Area)** | Takım veya ürün bazlı organizasyonel bölüm | "Backend", "Mobile" |
| **Kampanya** | Belirli bir sürüm veya sprint için gruplanmış test senaryoları | "Sprint 3 Kabul Testleri" |
| **Traceability** | Gereksinim → Test → Hata → Kod → Dağıtım zincirinin izlenebilirliği | — |

> **Önemli:** Bir iş kalemi silindiğinde kalıcı olarak silinmez; arşivlenir. Backlog'da "Silinenleri göster" filtresiyle geri getirilebilir.

---

## Bölüm 1: Arayüz ve Navigasyon

### Ekran Düzeni

Uygulama üç ana bölgeden oluşur:

```
┌──────────────────────────────────────────────────────────────────┐
│  Demo ▾          [🔍  Ara veya komut gir…  Ctrl+K]    🔔  YS ▾  │  ← ÜST BAR
├────────────────┬─────────────────────────────────────────────────┤
│                │                                                  │
│  PROJELER      │                                                  │
│  Dashboard     │                                                  │
│  ─────────     │           ANA İÇERİK ALANI                      │
│  ▾ Sample Prj  │                                                  │
│    Backlog     │   (Seçili sayfanın içeriği burada görünür)       │
│    Board       │                                                  │
│    Planlama    │                                                  │
│  ▾ Kalite      │                                                  │
│      Katalog   │                                                  │
│      Kampanya  │                                                  │
│      Çalıştır  │                                                  │
│      Hatalar   │                                                  │
│      İzleneblr │                                                  │
│    Otomasyon   │                                                  │
│  ─────────     │                                                  │
│  Ayarlar       │                                                  │
│                │                                                  │
└────────────────┴─────────────────────────────────────────────────┘
```

### Sol Menü

Sol menü iki katmanlıdır: **organizasyon düzeyi** (her zaman görünür) ve **proje düzeyi** (bir proje seçiliyken görünür).

**Organizasyon düzeyi:**

| Öğe | Ne yapar |
|-----|----------|
| Projeler | Tüm projelerin listesi |
| Dashboard | Organizasyon geneli metrikler ve aktivite akışı |

**Proje düzeyi** (bir proje seçildikten sonra açılır):

| Öğe | Ne yapar |
|-----|----------|
| Genel Bakış | Proje detay kartı |
| Backlog | İş kalemlerinin ağaç veya tablo görünümü |
| Board | Kanban — sürükle-bırak durum yönetimi |
| Planlama | Sprint ve sürüm döngüleri, alan hiyerarşisi |
| Kalite → Katalog | Test senaryosu kütüphanesi |
| Kalite → Kampanya | Test setleri |
| Kalite → Çalıştırmalar | Geçmiş test çalıştırmaları |
| Kalite → Hatalar | Defect listesi |
| Kalite → İzlenebilirlik | Gereksinim–test kapsama matrisi |
| Otomasyon | Olay tabanlı iş akışı kuralları |

**Ayarlar (organizasyon düzeyi):**

| Öğe | Ne yapar |
|-----|----------|
| Üyeler | Üye yönetimi ve davet |
| Roller | Rol oluşturma ve yetki ataması |
| Yetkiler | Sistem yetkilerinin salt okunur listesi |
| Denetim | Giriş/erişim kayıtları (yalnızca Admin) |
| Manifest | Süreç şablonları |

### Üst Bar

**Organizasyon adı (sol üst):** Tıklayarak erişiminiz olan başka bir organizasyona geçin.

**Komut Paleti (`Ctrl+K` / `Cmd+K`):** En hızlı gezinme yöntemi. Palet açıldığında:

- Herhangi bir sayfanın adını yazın → `Enter` ile atlayın
- Son ziyaret edilen projeler otomatik listelenir
- `↑ ↓` ok tuşlarıyla seçim yapın, `Esc` ile kapatın

**Kullanıcı menüsü (sağ üst avatar):** Tema (aydınlık/karanlık mod) ve çıkış.

> **İpucu:** Komut paletinde "backlog", "board", "üyeler" gibi Türkçe ya da İngilizce terimler çalışır.

---

## Bölüm 2: Giriş ve Organizasyon Yönetimi

### Giriş Yapma

1. Uygulama URL'sine gidin
2. **E-posta** ve **Şifre** girin
3. **Giriş Yap** butonuna tıklayın

Birden fazla organizasyona üyeyseniz, giriş sonrası organizasyon seçim ekranı gelir — çalışmak istediğinizi seçin.

> **Demo hesabı:** `admin@example.com` / `Admin123!` — tüm özelliklere erişim sağlar.

### Yeni Hesap Oluşturma

1. Giriş sayfasında **Kayıt Ol** bağlantısına tıklayın
2. Ad, e-posta ve şifrenizi girin
3. E-posta doğrulaması yapılandırılmışsa gelen kutunuzu kontrol edin

### Organizasyon Değiştirme

Sol üst köşedeki organizasyon adına tıklayın. Açılan açılır menüde erişiminiz olan tüm organizasyonlar listelenir.

### Organizasyon Ayarları

**Ayarlar → Genel:**

- Organizasyon adı ve kısa adı (slug) düzenleme
- **Tehlike Bölgesi:** Organizasyonu arşivleme — bu işlem geri alınamaz, dikkatli kullanın.

---

## Bölüm 3: Proje Kurulumu

### Projeleri Listeleme

Sol menüde **Projeler** öğesine tıklayın. Her proje kartında ad, kod, üye sayısı ve özet bilgiler görünür.

### Yeni Proje Oluşturma

1. Projeler sayfasında **+ Yeni Proje** butonuna tıklayın
2. Formu doldurun:

| Alan | Zorunlu | Kural ve Açıklama |
|------|---------|-------------------|
| **Proje Kodu** | Evet | 2–10 karakter, büyük harf ve rakam (`SAMP`, `MYPRJ01`). Sonradan değiştirilemez — dikkatli seçin. |
| **Proje Adı** | Evet | Anlamlı bir isim (örn. "Müşteri Portalı") |
| **Süreç Şablonu** | Evet | Projenin iş akışı şablonu: Basic, Scrum veya özel manifest |
| **Açıklama** | Hayır | Projenin amacı ve kapsamı |

3. **Oluştur** butonuna tıklayın

> **Uyarı:** Proje kodu, iş kalemlerinin birincil anahtarını oluşturur (`SAMP-1`, `SAMP-2`…). Bu kod sonradan değiştirilemez; başlangıçta doğru bir kod seçin.

### Proje Ayarları

Proje seçiliyken **Ayarlar** bağlantısına tıklayın:

**Genel:** Proje adını ve açıklamasını düzenleyin.

**Üyeler:** Projeye ekip üyesi ekleyin ve proje bazında rol atayın. Organizasyon üyesi olmayan biri projeye eklenemez; önce Ayarlar → Üyeler üzerinden organizasyona davet edilmesi gerekir.

**Takımlar:** Birden fazla ekip varsa takım oluşturun (örn. "Frontend", "Backend"). Görevler takımlara atanabilir.

---

## Bölüm 4: Backlog ve İş Kalemleri

Backlog, projedeki tüm iş kalemlerinin — gereksinimler, kullanıcı hikayeleri, hatalar, görevler — yönetildiği merkezi sayfadır.

### Görünüm Seçenekleri

Sağ üstteki ikon düğmeleriyle iki görünüm arasında geçiş yapın:

**Ağaç Görünümü (Tree View)**
Hiyerarşik ilişkileri (Epic → Feature → User Story) görsel olarak gösterir. Bir öğeyi başka bir öğenin altına taşımak için sürükleyip bırakın.

**Tablo Görünümü (Table View)**
Satır bazlı tablo; hücrelere tıklayarak satır içi düzenleme yapılır. Çok sayıda iş kalemini hızlı güncellemek için idealdir.

### Tablo Sütunları

| Sütun | Açıklama |
|-------|----------|
| Anahtar | Benzersiz kimlik — `SAMP-42` |
| Başlık | İş kaleminin adı |
| Tür | Artifact tipi |
| Durum | Güncel workflow durumu |
| Atanan | Sorumlu kişi |
| Etiketler | Çoklu etiket |
| Döngü | Sprint / sürüm ataması |
| Alan | Organizasyonel alan |
| Oluşturulma | Oluşturma tarihi |
| Güncelleme | Son değişiklik tarihi |

Manifest'te tanımlanan özel alanlar (öncelik, story puanı, etkilenen versiyon…) ek sütunlar olarak görünür.

> **İpucu:** Sütun başlığına sağ tıklayarak görünür sütunları özelleştirin. Sık kullanmadığınız sütunları gizleyerek çalışma alanınızı sadeleştirin.

### Yeni İş Kalemi Oluşturma

1. **+ Yeni** butonuna tıklayın
2. Oluşturmak istediğiniz türü seçin — liste projenin manifest'ine göre değişir:

| Tür | Kullanım amacı |
|-----|----------------|
| **Epic** | Büyük iş paketi, birden fazla sprintte biter |
| **Feature** | Epic'in alt bileşeni |
| **User Story** | Tek bir kullanıcı ihtiyacını ifade eder |
| **Defect / Bug** | Saptanan hata veya kusur |
| **Task** | Teknik alt görev |

3. Formu doldurun:

| Alan | Zorunlu | Açıklama |
|------|---------|----------|
| **Başlık** | Evet | Kısa ve net (örn. "Kullanıcı şifresini sıfırlayabilmeli") |
| **Açıklama** | Hayır | Detay, kabul kriterleri, teknik notlar |
| **Atanan** | Hayır | Sorumlu ekip üyesi |
| **Döngü** | Hayır | Hangi sprint'e ait |
| **Alan** | Hayır | Organizasyonel alan |
| **Etiketler** | Hayır | Çoklu etiket |
| Özel Alanlar | Türe bağlı | Öncelik, story puanı, sürüm, vb. |

4. **Kaydet**

> **İpucu:** Ağaç görünümünde bir öğe seçiliyken `+ Yeni` butonuna basarsanız yeni iş kalemi otomatik olarak seçili öğenin altına eklenir.

### İş Kalemini Düzenleme

**Satır içi düzenleme (tablo):** Hücreye tıklayın, değeri değiştirin, `Enter` veya tablo dışına tıklayın.

**Detay panelinde düzenleme:** İş kalemi satırına tıklayın — detay paneli açılır. Herhangi bir alana tıklayarak düzenleme moduna geçin.

### Filtreleme ve Arama

Backlog araç çubuğu zengin filtreleme seçenekleri sunar:

| Filtre | Açıklama |
|--------|----------|
| Arama | Başlık, açıklama veya anahtar üzerinden anlık arama |
| Durum | Bir veya birden fazla workflow durumu |
| Tür | Artifact tipi |
| Sürüm | Belirli sürüme atananlar |
| Döngü | Belirli sprint'e atananlar |
| Alan | Belirli alana atananlar |
| Etiket | Etiket bazlı filtreleme |
| Atanan | Kişi veya "Atanmamış" |
| Sıralama | Herhangi sütuna göre artan/azalan |
| Silinenleri Göster | Arşivlenmiş iş kalemlerini listele |
| Bayat İzlenebilirlik | Test bağlantısı olmayan gereksinimleri listele |

**Filtre kaydetme (Saved Queries):**

Aynı filtre kombinasyonunu tekrar tekrar kullanıyorsanız kaydedin:

1. İstediğiniz filtreleri uygulayın
2. Araç çubuğunda **Sorgu Kaydet** (ya da disket ikonu) butonuna tıklayın
3. Sorguya bir ad verin ve kapsam seçin: **Kişisel** (yalnızca siz) veya **Proje** (tüm ekip)
4. Kaydettiğiniz sorgular filtre alanının üstünde listelenir — tek tıkla uygulanır

### Toplu İşlemler

Birden fazla iş kalemini seçip aynı anda güncelleyebilirsiniz:

1. Satır başındaki onay kutucuklarına tıklayarak iş kalemlerini seçin (başlık satırındaki kutu tümünü seçer)
2. Araç çubuğunda beliren toplu eylem butonlarından birini seçin:

| Eylem | Açıklama |
|-------|----------|
| Toplu Durum Değiştir | Seçili tüm kalemleri aynı duruma geçirir |
| Toplu Atama | Sorumluyu değiştirir |
| Toplu Sil | Seçili kalemleri arşivler |

### Dışa ve İçe Aktarma

**Dışa aktarma:** Araç çubuğundaki `⋯` menüsü → **CSV olarak dışa aktar** veya **Excel olarak dışa aktar**.

**İçe aktarma:** `⋯` → **CSV'den içe aktar** → şablon indirip doldurun ve yükleyin.

> **Not:** İçe aktarmada mevcut iş kalemleri güncellenmez; her satır yeni bir iş kalemi olarak oluşturulur.

---

## Bölüm 5: İş Kalemi Detay Paneli

Herhangi bir iş kalemine tıkladığınızda sağ tarafta detay paneli açılır. Panel, iş kalemine ilişkin tüm bilgileri sekmeler halinde sunar.

### Panel Başlığı

```
SAMP-42                                           [Durum: Active ▾]  [2 kullanıcı]
─────────────────────────────────────────────────────────────────────────────────
Kullanıcı şifresini e-posta ile sıfırlayabilmeli
─────────────────────────────────────────────────────────────────────────────────
Tür: User Story   Atanan: Ahmet Yılmaz   Etiket: auth, güvenlik
Oluşturulma: 3 Mart 2026   Son güncelleme: 2 saat önce
```

- **Anahtar** (`SAMP-42`): Tıklayarak panoya kopyalayın
- **Durum rozeti:** Tıklayarak izin verilen durumlar arasında geçiş yapın
- **Aktif kullanıcı sayısı:** Aynı anda bu iş kalemini görüntüleyen kişi sayısı — gerçek zamanlı

### Durum Geçişi

Durum rozetine tıkladığınızda, manifest'in izin verdiği hedef durumlar listelenir. Bazı geçişler ek bilgi gerektirebilir:

| Geçiş koşulu | Açıklama |
|-------------|----------|
| **Geçiş nedeni** | İsteğe bağlı veya zorunlu not ("Neden beklemeye alındı?") |
| **Çözüm tipi** | Defect kapatılırken: `Fixed`, `Duplicate`, `Won't Fix`, `As Designed` |

---

### Sekme 1: Detaylar

İş kaleminin tüm alanlarını gösterir ve düzenlemenizi sağlar:

- **Açıklama:** Zengin metin editörü; başlık, liste, kalın/italik, bağlantı destekler
- **Döngü ve Alan:** Açılır menüden değiştirilebilir
- **Manifest özel alanları:** Projeye göre değişen ek alanlar (öncelik, story puanı, etkilenen versiyon, ortam, yeniden üretilebilirlik…)

---

### Sekme 2: Görevler (Tasks)

İş kalemini tamamlamak için yapılması gereken teknik alt adımlar.

**Görev ekleme:**

1. **+ Görev Ekle** butonuna tıklayın
2. Formu doldurun:

| Alan | Açıklama |
|------|----------|
| Başlık | Görevin kısa adı (örn. "E-posta şablonu hazırla") |
| Açıklama | Detay |
| Atanan | Sorumlu kişi |
| Takım | Proje takımı (birden fazla takım varsa görünür) |
| Saatler | Tahmini süre |
| Aktivite | Görev kategorisi (geliştirme, test, dokümantasyon…) |
| Etiketler | Çoklu etiket |

3. **Kaydet**

Görevler sürükle-bırak ile yeniden sıralanabilir. Her görevin durum değiştirme düğmesi (`To Do → In Progress → Done`) bulunur.

---

### Sekme 3: Bağlantılar (Links)

İş kalemleri arasında ilişki kurun. İki iş kalemi arasında birden fazla farklı tipte bağlantı olabilir.

**Bağlantı ekleme:**

1. **+ Bağla** butonuna tıklayın
2. İlişki tipini seçin:

| İlişki Tipi | Ne anlama gelir |
|------------|-----------------|
| `depends-on` | Bu iş kalemi, hedefi bekliyor (hedef önce tamamlanmalı) |
| `blocks` | Bu iş kalemi, hedefin ilerlemesini engelliyor |
| `relates-to` | Bağımlılık olmaksızın ilgili |
| `parent` | Üst öğe |
| `implements` | Bir gereksinimi karşılıyor |
| `traces-to` | İzlenebilirlik için bağlı (genellikle test → gereksinim) |

3. Hedef iş kalemini arayın (anahtar veya başlık ile)
4. **Ekle**

**Gelen bağlantılar:** Başka iş kalemlerinin bu öğeye yaptığı bağlantılar ayrı bölümde "Gelen Bağlantılar" altında görünür.

---

### Sekme 4: Kaynak Kod (Source)

SCM (Git) entegrasyonu aktifse bu sekmede commit, branch ve PR bilgileri görünür.

- Branch adı ve son commit
- Commit hash ve mesajı
- Pull Request / Merge Request başlığı ve durumu (açık/kapalı/merge)

> **Not:** Bu sekmenin içerik göstermesi için projenizde SCM webhook yapılandırması gerekir. Bkz. [Bölüm 12: SCM Entegrasyonu](#scm-entegrasyonu).

---

### Sekme 5: Dağıtım (Deploy)

Bu iş kaleminin hangi deployment'lara dahil edildiğini gösterir:

- Deployment adı ve ortamı (Production, Staging…)
- Dağıtım tarihi ve sürüm etiketi
- Başarı/başarısız durumu

---

### Sekme 6: Etki Analizi (Impact)

Bir iş kaleminin neleri etkilediğini veya neden etkilendiğini hiyerarşik olarak gösterir.

**Kullanım:**

1. **Derinlik:** 1–5 seviye arasında seçin
2. **İlişki filtreleri:** Görmek istediğiniz bağlantı tiplerini seçin
3. **Düğümlere tıklayın:** İlgili iş kalemini ayrı panelde açın

**Senaryo:** Bir Epic'in kapsamını değiştirmeyi planlıyorsunuz. Etki Analizi'nde bu Epic'e bağlı 5 User Story, 3 Test Senaryosu ve 1 açık Defect görebilirsiniz — kararı vermeden önce tüm etkiyi kavrayabilirsiniz.

---

### Sekme 7: Ekler (Attachments)

| İşlem | Nasıl yapılır |
|-------|--------------|
| Dosya yükleme | Sürükle-bırak veya "Dosya Seç" butonu |
| İndirme | Dosya satırındaki indirme ikonu |
| Silme | Dosya satırındaki çöp kutusu ikonu (izne bağlı) |

Her dosya için: ad, boyut (KB/MB), yükleyen kişi, yüklenme tarihi gösterilir.

---

### Sekme 8: Yorumlar (Comments)

- **Yorum ekle:** Alt kısımdaki metin alanına yazın, **Gönder** butonuna basın
- Her yorumda: avatar, kullanıcı adı, tarih ve saat
- Kendi yorumunuzu düzenleyebilir veya silebilirsiniz
- `@kullanıcı_adı` yazarak birini etiketleyebilirsiniz

---

### Sekme 9: Denetim (Audit)

Bu iş kaleminde yapılan tüm değişikliklerin tam geçmişi:

| Sütun | İçerik |
|-------|--------|
| Zaman | Değişikliğin kesin tarihi ve saati |
| Kullanıcı | Değişikliği yapan kişi |
| Olay | Oluşturuldu, güncellendi, durum değiştirildi, yorum eklendi… |
| Eski Değer | Değişiklik öncesi içerik |
| Yeni Değer | Değişiklik sonrası içerik |

---

## Bölüm 6: Kalite ve Test Yönetimi

Kalite modülü beş alt bölümden oluşur: **Katalog**, **Kampanya**, **Çalıştırmalar**, **Hatalar**, **İzlenebilirlik**.

### 6.1 Test Kataloğu

Tüm test senaryolarının kütüphanesidir. Senaryolar hiyerarşik klasörler halinde organize edilir.

#### Test Senaryosu Oluşturma

1. **Kalite → Katalog** sayfasına gidin
2. İstediğiniz klasörü seçin (veya kök düzeyde çalışın)
3. **+ Yeni Test** butonuna tıklayın
4. Formu doldurun:

| Alan | Zorunlu | Açıklama |
|------|---------|----------|
| Başlık | Evet | Test senaryosunun adı |
| Açıklama | Hayır | Amacı ve kapsamı |
| Adımlar | Hayır | Her adım için: eylem + beklenen sonuç |
| Parametreler | Hayır | Tekrar çalıştırmak için değişken tanımları |
| Etiketler | Hayır | Kategorileme |

5. **Kaydet**

#### Test Adımları

Bir testi anlamlı kılan, adımlarının açıklığıdır. İyi yazılmış bir adım şöyle görünür:

| # | Eylem | Beklenen Sonuç |
|---|-------|----------------|
| 1 | Giriş sayfasını aç | Sayfa yüklenir, form alanları görünür |
| 2 | Geçerli e-posta ve şifre gir | Alanlar dolduğu gözlemlenir |
| 3 | "Giriş Yap" butonuna tıkla | Ana dashboard açılır, kullanıcı adı üst barda görünür |

#### Parametrik Test

Aynı senaryoyu farklı verilerle çalıştırmanız gerekiyorsa parametreler kullanın:

- Parametre tanımı: `kullanici_adi`, `sifre`
- Çalıştırma sırasında her parametre için farklı değer seti girilir
- Sonuçlar her kombinasyon için ayrı ayrı kaydedilir

#### Testi Gereksinime Bağlama

1. Test detayında **Bağlantılar** sekmesine gidin
2. **+ Bağla** → İlişki tipi: `traces-to` veya `implements`
3. İlgili User Story veya gereksinimi arayıp seçin
4. **Ekle**

> **Neden önemli?** Bu bağlantı kurulmadan İzlenebilirlik Matrisi gereksinimlerinizin test edilip edilmediğini bilemez ve kapsama boşluklarını göremezsiniz.

---

### 6.2 Test Kampanyası

Kampanya; belirli bir sprint veya sürüm için çalıştırılacak test grubunu temsil eder. Bir test senaryosu birden fazla kampanyaya eklenebilir.

#### Kampanya Oluşturma

1. **Kalite → Kampanya → + Yeni Kampanya**
2. Kampanya adını ve kapsamını girin
3. **Oluştur**

#### Kampanyaya Test Ekleme

1. Kampanya içinde **+ Test Ekle**
2. Katalogdan test senaryolarını arayıp seçin — çoklu seçim desteklenir
3. **Ekle**

---

### 6.3 Test Çalıştırma (Test Run)

Çalıştırma, bir kampanyanın belirli bir tarihte ve belirli bir ortamda gerçekleştirilmesidir.

#### Yeni Çalıştırma Başlatma

1. Kampanya sayfasında **+ Yeni Çalıştırma**
2. Formu doldurun:

| Alan | Açıklama |
|------|----------|
| Başlık | Çalıştırmanın adı (otomatik doldurulur, değiştirilebilir) |
| Açıklama | Bu çalıştırma hakkında notlar |
| Ortam | Test ortamı: Staging, UAT, Production… |

3. **Başlat**

#### Test Sonucu Girme

Her test satırı için dört seçenekten birini işaretleyin:

| Simge | Sonuç | Ne zaman kullanılır |
|-------|-------|---------------------|
| ✅ | **Geçti** | Test tam olarak beklenen şekilde çalıştı |
| ❌ | **Başarısız** | Beklenen sonuç alınamadı |
| ⏸ | **Engellendi** | Test çalıştırılamadı (ortam hazır değil, ön koşul sağlanamadı…) |
| ⬜ | **Çalıştırılmadı** | Henüz yürütülmedi |

#### Başarısız Testten Hata Oluşturma

1. Başarısız (`❌`) sonucu olan test satırında **Hata Oluştur** butonuna tıklayın
2. Form, testin bağlamıyla otomatik doldurulur (çalıştırma adı, adım, kaynak)
3. Eksik alanları tamamlayın:
   - Önem derecesi (1-Kritik → 4-Düşük)
   - Sorumlu kişi
4. **Kaydet**

Yeni Defect otomatik olarak bu test senaryosuna bağlanır — İzlenebilirlik Matrisi'nde görünür.

---

### 6.4 Hata Yönetimi (Defects)

**Kalite → Hatalar** sayfasında projenin tüm Defect kayıtları listelenir.

#### Defect'e Özgü Alanlar

Defect tipindeki iş kalemlerinde standart alanlara ek olarak şunlar bulunur:

| Alan | Açıklama |
|------|----------|
| Önem Derecesi | 1-Kritik, 2-Yüksek, 3-Orta, 4-Düşük |
| Yeniden Üretilebilirlik | Her Zaman / Bazen / Nadiren / Üretilemedi |
| Tespit Edilen Versiyon | Hatanın ilk görüldüğü yazılım sürümü |
| Düzeltilen Versiyon | Hatanın çözüldüğü sürüm |
| Ortam | Üretim, Staging, UAT… |
| Çözüm Tipi | Fixed / Duplicate / Won't Fix / As Designed |

#### Defect Yaşam Döngüsü

```
New ──→ Active ──→ Resolved ──→ Closed
  ↑          │
  └──────────┘  (yeniden açılabilir)
```

---

### 6.5 İzlenebilirlik Matrisi

**Kalite → İzlenebilirlik** sayfası, gereksinimlerinizin test kapsama durumunu tek bakışta gösterir.

#### Renk Kodlaması

| Renk | Anlam |
|------|-------|
| 🟢 Yeşil | Bu gereksinime bağlı tüm testler geçti |
| 🔴 Kırmızı | En az bir test başarısız |
| 🟡 Sarı | Bağlı test var ama henüz sonuç girilmedi |
| ⚪ Gri | Bu gereksinime hiç test bağlanmamış |

#### Kullanım

- Satıra tıklayın → o gereksinime bağlı testlerin, çalıştırma sonuçlarının ve defect'lerin detayı açılır
- **Bayat İzlenebilirlik** filtresi (Backlog'da): hiç test bağlanmamış gereksinimleri öne çıkarır
- Sürüm öncesi kalite kapısı değerlendirmesinde bu sayfayı kullanın: kırmızı veya gri satır sayısının sıfır olması hedeflenir

---

## Bölüm 7: Board ve Kanban

Board, iş kalemlerini workflow durumlarına göre sütunlar halinde görselleştirir ve sürükle-bırak ile durum değiştirmeyi sağlar.

### Board Yapılandırma

Sayfa açıldığında filtre paneli görünür — en azından **Tür** seçmeniz gerekir:

| Filtre | Zorunlu | Açıklama |
|--------|---------|----------|
| Tür | Evet | Hangi artifact tipini görmek istiyorsunuz |
| Döngü | Hayır | Belirli sprint |
| Sürüm | Hayır | Belirli sürüm |
| Alan | Hayır | Belirli alan |
| Atanan | Hayır | Belirli kişi veya atanmamışlar |
| Arama | Hayır | Başlık araması |

> **İpucu:** Kendi işlerinize odaklanmak için "Atanan: Ben" filtresini kullanın.

### Sütun Yapısı

Her sütun bir workflow durumunu temsil eder. Sütun başlığında durum adı ve o durumdaki kart sayısı gösterilir.

### Kart Bilgileri

Her kart şunları gösterir:

- Artifact anahtarı (`SAMP-42`)
- Başlık (uzunsa kısaltılır)
- Tür rozeti (renkli — Defect kırmızı, Epic mor…)
- Atanan kişinin avatarı
- Etiketler (varsa)

### Kart İşlemleri

**Tıklama:** Detay panelini açar.

**Sürükle-Bırak:** Kartı başka bir sütuna taşıyın — iş kaleminin durumu otomatik güncellenir.

- İzin verilmeyen geçişler engellenir ve neden izin verilmediği belirtilir
- Geçiş nedeni gerektiren durumlar için küçük bir form açılır; doldurup onaylayın

> **Not:** Durum geçişleri manifest kurallarıyla sınırlıdır. Örneğin `Closed → Active` geçişi manifest'te tanımlı değilse Board'da o sütuna kart taşıyamazsınız.

---

## Bölüm 8: Planlama, Sprint ve Sürüm

**Planlama** sayfası üç bölümden oluşur: **Döngüler**, **Sürümler**, **Alanlar**.

### Döngü (Sprint) Oluşturma

1. **Planlama → Döngüler → + Yeni Döngü**
2. Formu doldurun:

| Alan | Açıklama |
|------|----------|
| Ad | Sprint adı (örn. "Sprint 3") |
| Başlangıç Tarihi | Sprint başlangıcı |
| Bitiş Tarihi | Sprint sonu |

3. **Oluştur**

### Sürüm (Release) Oluşturma

1. **Planlama → Sürümler → + Yeni Sürüm**
2. Sürüm adı ve tarih aralığını girin
3. **Oluştur**

Döngüler sprint içi planlamaya, Sürümler ise birden fazla sprint kapsayan teslimat planlamasına yöneliktir.

### İş Kalemlerini Döngüye Atama

**Yöntem A — İş kalemi detayından:**
İş kalemi detayında **Döngü** alanına tıklayın → listeden seçin.

**Yöntem B — Tablo görünümünden:**
Tablo görünümünde **Döngü** sütunundaki hücreye tıklayın → seçin.

**Yöntem C — Toplu atama:**
Birden fazla iş kalemini seçin → Toplu Atama → Döngü alanını güncelleyin.

### Alan (Area) Yönetimi

Takım, ürün veya coğrafi bölge bazlı hiyerarşi:

1. **Planlama → Alanlar → + Yeni Alan**
2. Alan adını girin; üst alan seçebilirsiniz (örn. "Ürün → Backend")
3. **Oluştur**

İş kalemlerinin **Alan** alanına tıklayarak atama yapın. Board ve Backlog'da alan filtresi kullanarak yalnızca ilgili alanın iş kalemlerini görün.

---

## Bölüm 9: İzlenebilirlik ve Etki Analizi

### Tam İzlenebilirlik Zinciri

ALM, yazılım yaşam döngüsü boyunca her katmanı birbirine bağlar:

```
Gereksinim  (Epic / Feature / User Story)
     │  traces-to / implements
     ▼
Test Senaryosu  (Katalog)
     │  çalıştırılınca
     ▼
Test Çalıştırması  →  Sonuç: ✅ / ❌ / ⏸
     │  başarısız olunca
     ▼
Defect  (Hata)
     │  düzeltilince — commit mesajı: "SAMP-55: fix"
     ▼
Kaynak Kod  (Commit / Branch / PR)
     │  merge → deploy
     ▼
Deployment  (Ortam + Sürüm)
```

Bu zincirin her halkası, ilgili iş kaleminin detay panelinde görünür.

### 9.1 İzlenebilirlik Matrisi

Bkz. [Bölüm 6.5](#65-izlenebilirlik-matrisi).

### 9.2 Etki Analizi

Bir değişikliğin etkisini anlamak için:

1. İş kalemi detay panelini açın
2. **Etki** sekmesine geçin
3. Derinlik seviyesini ayarlayın (1 = yalnızca doğrudan bağlantılar, 5 = beş kat uzağa kadar)
4. Ağaçtaki düğümlere tıklayarak ilgili iş kalemlerini açın

### 9.3 İzlenebilirlik Boşluklarını Kapatma

**Bayat İzlenebilirlik filtresi:**

Backlog'da filtreleme alanında "Bayat İzlenebilirlik" kutucuğunu işaretleyin. Bu filtre, hiç test senaryosu bağlantısı olmayan gereksinimleri (User Story, Feature…) listeler.

Sürüm öncesi hedef: bu liste boş olmalıdır.

---

## Bölüm 10: Otomasyon Kuralları

Tekrarlayan manüel adımları otomatikleştirmek için kural tabanlı otomasyon kullanın.

### Kural Yapısı

```
[Tetikleyici]  →  [Koşul (isteğe bağlı)]  →  [Aksiyon]
```

**Örnek kural:**
> "Bir Defect durumu `Resolved` olarak değiştiğinde → eğer önem derecesi `1-Kritik` ise → Slack'e bildirim gönder (webhook)"

### Kural Oluşturma

1. **Otomasyon → + Yeni Kural**

2. **Tetikleyici** seçin:

| Tetikleyici | Ne zaman ateşlenir |
|------------|-------------------|
| `artifact_state_changed` | Durum değiştiğinde |
| `artifact_assigned` | Atama değiştiğinde |
| `artifact_created` | Yeni iş kalemi oluşturulduğunda |
| `artifact_commented` | Yorum eklendiğinde |

3. **Koşul** (isteğe bağlı): Koşul olmadan kural her tetikleme anında çalışır. Koşul ekleyerek kuralı daraltın:
   - Tür = `Defect`
   - Alan = `Backend`
   - Özel alan değeri = belirli bir değer

4. **Aksiyon** tanımlayın:
   - **Webhook:** Belirtilen URL'ye HTTP POST gönderir — Slack, Teams, Jira entegrasyonları için kullanılır
   - **Log:** Sistem loguna kayıt düşer (hata ayıklama için)

5. Kuralı **Aktif** durumuna getirin

6. **Kaydet**

### Kuralları Yönetme

Kural listesinde her satırda:

- **Aktif/Pasif toggle:** Kuralı geçici olarak devre dışı bırakın
- **Son tetiklenme:** En son ne zaman ateşlendiği
- **Silme:** Kalıcı olarak silin

---

## Bölüm 11: Üye ve Rol Yönetimi

### Üye Davet Etme

1. **Ayarlar → Üyeler → + Davet Et**
2. E-posta adresini girin
3. Bir veya birden fazla rol seçin
4. **Davet Gönder**

SMTP yapılandırması aktifse kişiye otomatik e-posta gönderilir. Aktif değilse bağlantıyı manuel paylaşın.

### Kullanıcı Oluşturma (Sadece Admin)

Davet yerine direkt hesap oluşturmak için:

1. **+ Kullanıcı Oluştur**
2. Ad, e-posta ve şifreyi girin
3. Rol atayın
4. **Oluştur**

### Üye Silme

Üyeler listesinde satır sonundaki silme ikonuna tıklayın → onay penceresini onaylayın.

> **Not:** Silinmiş üyeler tamamen kaldırılmaz; arşivlenir. **"Silinenleri göster"** kutucuğu ile listeye dahil edilir ve gerekirse geri getirilebilir.

### Üye İstatistikleri

Sayfanın üstündeki özet kartlar:

| Kart | Açıklama |
|------|----------|
| Toplam Üye | Organizasyondaki tüm üyeler |
| Aktif Üye | Silinmemiş üyeler |
| Silinmiş Üye | Arşivlenmiş üyeler |

---

### Rol Yönetimi

#### Sistem Rolleri

Bu roller önceden tanımlıdır ve düzenlenemez:

| Rol | Hiyerarşi | Yetki Özeti |
|-----|-----------|-------------|
| **Admin** | En yüksek | Her şeye tam erişim; üye, rol ve organizasyon yönetimi |
| **Editor** | Orta | İş kalemi oluşturma, güncelleme, test yönetimi |
| **Viewer** | Düşük | Yalnızca okuma |

#### Özel Rol Oluşturma

Ekibinize özgü bir rol gerekiyorsa (örn. "Test Uzmanı", "Güvenlik Gözlemcisi"):

1. **Ayarlar → Roller → + Yeni Rol**
2. Formu doldurun:

| Alan | Açıklama |
|------|----------|
| Ad | Rol adı |
| Açıklama | Rolün amacı |
| Hiyerarşi Seviyesi | Sayısal değer; yüksek = daha fazla yetki |

3. **Yetkiler** sekmesine geçin ve izinleri işaretleyin:

**Artifact (İş Kalemi) Yetkileri:**

| Yetki | Açıklama |
|-------|----------|
| `artifact:create` | Yeni iş kalemi oluştur |
| `artifact:read` | İş kalemlerini görüntüle |
| `artifact:update` | Alanları düzenle |
| `artifact:delete` | Arşivle |
| `artifact:transition` | Durum değiştir |
| `artifact:assign` | Atama yap |
| `artifact:comment` | Yorum ekle |
| `artifact:read_sensitive` | Gizli / hassas alanları görüntüle |

**Diğer Yetki Grupları:**

| Grup | Örnek Yetkiler |
|------|----------------|
| Proje | `project:create`, `project:read`, `project:update` |
| Manifest | `manifest:read`, `manifest:activate` |
| Üye | `member:invite`, `member:remove`, `member:change_role` |
| Rol | `role:create`, `role:update` |
| Organizasyon | `tenant:read`, `tenant:update` |
| Denetim | `audit:read` |
| Workflow | `workflow:create`, `workflow:update` |
| Görev | `task:create`, `task:read`, `task:update`, `task:assign` |

4. **Kaydet**

---

### Denetim Kaydı (Audit Log)

**Ayarlar → Denetim** sayfası yalnızca `audit:read` yetkisine sahip kullanıcılar (varsayılan: Admin) tarafından erişilebilir.

#### Kayıt Türleri

| Tür | Açıklama |
|-----|----------|
| `LOGIN_SUCCESS` | Başarılı giriş |
| `LOGIN_FAILURE` | Başarısız giriş denemesi |

#### Sütunlar

| Sütun | Açıklama |
|-------|----------|
| Zaman | Olayın kesin tarihi ve saati |
| Tür | Başarılı / Başarısız |
| E-posta | İşlemi gerçekleştiren kullanıcı |
| IP Adresi | Bağlantı IP'si |
| Kullanıcı Ajanı | Tarayıcı ve işletim sistemi |

#### Filtreler

| Filtre | Açıklama |
|--------|----------|
| Başlangıç Tarihi | Log aralığının başı |
| Bitiş Tarihi | Log aralığının sonu |
| Olay Türü | Tümü / Başarılı Giriş / Başarısız Giriş |
| Limit | Gösterilecek kayıt sayısı (varsayılan: 200) |

> **Güvenlik İpucu:** Belirli bir IP'den art arda başarısız giriş girişimleri olup olmadığını düzenli aralıklarla kontrol edin. Bu, kaba kuvvet saldırılarının erken bir göstergesi olabilir.

---

## Bölüm 12: Manifest ve Süreç Şablonları

Manifest; projedeki iş kalemi türlerini, durum makinelerini ve geçiş kurallarını tanımlayan yapılandırma dosyasıdır. Bir proje oluşturulurken bir manifest şablonu seçilir.

### Yerleşik Şablonlar

| Şablon | Hiyerarşi | Uygun Ekipler |
|--------|-----------|---------------|
| **Basic** | Düz liste | Küçük veya tek kişilik projeler |
| **Scrum** | Epic → Feature → User Story → Task | Agile/Scrum ekipler |
| **ADO-Style** | Epic → Feature → User Story / Bug / Task | Azure DevOps alışkanlığı olanlar |

### Manifest Görüntüleme

**Ayarlar → Manifest** sayfasında organizasyondaki tüm şablon sürümleri listelenir. Her şablonda:

- İş kalemi türleri ve hiyerarşi
- Her tip için durum listesi
- İzin verilen durum geçişleri ve koşullar

### Manifest Versiyonlama

1. Aktif versiyonu **Düzenle** veya **+ Yeni Versiyon** ile kopyala
2. YAML editörde değişiklik yap
3. **Doğrula** — şema hataları vurgulanır
4. Hata yoksa **Aktifleştir** → projeye uygula

> **Uyarı:** Manifest değişikliği tüm mevcut iş kalemlerini etkiler. Yeni bir durum eklemek zararsızdır, ancak mevcut bir durumu kaldırmak ya da geçiş kuralını değiştirmek beklenmedik sonuçlar doğurabilir. Üretim ortamına uygulamadan önce test edin.

### SCM Entegrasyonu

Git commit ve PR'ları iş kalemlerine otomatik bağlamak için:

1. GitHub / GitLab projenizde **Webhook** ayarını açın
2. ALM'de **Proje Ayarları → SCM** bölümünden webhook URL'sini alın
3. Webhook olaylarını seçin: `push`, `pull_request`
4. Commit mesajlarınızda iş kalemi anahtarını kullanın:

```
SAMP-42: implement password reset flow
SAMP-55 fix: resolve redirect loop after login
```

Bundan sonra her commit ve PR, ilgili iş kaleminin **Source** sekmesinde otomatik görünür.

---

## Bölüm 13: Dashboard ve Raporlama

Dashboard, organizasyon veya proje düzeyinde özet metrikler ve aktivite akışı sunar.

### Özet Kartlar

| Kart | Açıklama | Tıklanınca |
|------|----------|------------|
| Toplam Proje | Organizasyondaki proje sayısı | Projeler sayfasına gider |
| Backlog Kalemleri | Aktif iş kalemi sayısı | Backlog'a gider |
| Görevler | Toplam görev sayısı | Görev listesine gider |
| Açık Hatalar | Çözümlenmemiş defect sayısı | Defect listesine gider |

### Grafikler

**Dağılım (Pasta Grafik):** Projeler, backlog, görevler ve hataların toplamda oranı.

**Velocity (Çizgi / Alan Grafik):** Sprint bazında tamamlanan iş miktarı; ekibin hızını ve trendini gösterir.

**Burndown (Yığılmış Bar Grafik):** Bir sprint içinde tamamlanan ve kalan iş kalemlerinin günlük dağılımı.

**Aktivite Akışı:** Son değişiklikler zaman sırasıyla:

| Sütun | Açıklama |
|-------|----------|
| Zaman | "5dk önce", "2 saat önce", "3 gün önce" |
| Kullanıcı | İşlemi yapan kişi |
| Olay | Oluşturuldu, güncellendi, durum değiştirildi… |
| İş Kalemi | Bağlantılı iş kalemi başlığı |

### Kontroller

| Kontrol | Açıklama |
|---------|----------|
| Proje Seçici | Tüm organizasyon veya belirli proje |
| Zaman Aralığı | Hafta / Ay / Yıl |
| Sürüm Filtresi | Tüm sürümler veya belirli sürüm |
| Yalnızca Bu Proje | Organizasyon geneli yerine seçili projeye odaklan |

---

## Bölüm 14: Adım Adım İş Akışları

Bu bölümde gerçek demo verisi kullanılarak dört temel iş akışı uçtan uca gösterilmektedir.

---

### Akış A: Gereksinim → Test → Hata → Düzeltme

**Senaryo:** "Sample Project" (`SAMP`) üzerinde kullanıcı girişi özelliğini geliştiriyorsunuz.

**1. Epic oluştur**

- Backlog → **+ Yeni** → Tür: **Epic**
- Başlık: `Kullanıcı Kimlik Doğrulama Modülü`
- Kaydet → anahtar atanır: `SAMP-10`

**2. User Story ekle**

- `SAMP-10` seçiliyken **+ Yeni** → Tür: **User Story**
- Başlık: `Kullanıcı e-posta ve şifre ile giriş yapabilmeli`
- Atanan: Ahmet Yılmaz | Story Puanı: 3 | Döngü: Sprint 3
- Kaydet → `SAMP-11`

**3. Test senaryosu oluştur**

- Kalite → Katalog → **+ Yeni Test**
- Başlık: `Geçerli kimlik bilgileri ile giriş`
- Adımlar:

| # | Eylem | Beklenen Sonuç |
|---|-------|----------------|
| 1 | Giriş sayfasını aç | Form alanları görünür |
| 2 | Geçerli e-posta ve şifre gir | Alanlar dolduğu gözlemlenir |
| 3 | "Giriş Yap" butonuna tıkla | Ana dashboard açılır |

**4. Testi gereksinime bağla**

- Test detayı → Bağlantılar → **+ Bağla**
- İlişki: `traces-to` → `SAMP-11`'i seç → **Ekle**

**5. Test kampanyası oluştur**

- Kalite → Kampanya → **+ Yeni Kampanya**
- Ad: `Sprint 3 Kabul Testleri`
- **Test Ekle** → "Geçerli kimlik bilgileri ile giriş" testini seç

**6. Çalıştırma yap**

- Kampanya → **+ Yeni Çalıştırma** → Ortam: `Staging`
- Test adımlarını uygula → Sonuç: **Başarısız** ❌
- Not: "Giriş sonrası ana sayfa yerine 404 hatası veriyor"

**7. Defect oluştur**

- Başarısız test satırı → **Hata Oluştur**
- Başlık: `Giriş sonrası yönlendirme hatası (404)`
- Önem: 1-Kritik | Atanan: Zeynep Kaya
- Kaydet → `SAMP-12`

**8. Geliştirici hatayı düzeltir**

- `SAMP-12` → Durum: `Active`
- Kod düzeltmesi yapılır, commit: `SAMP-12: fix post-login redirect`
- `SAMP-12` → Durum: `Resolved` → Çözüm: `Fixed` → Düzeltilen Versiyon: `v1.1.1`

**9. Testi yeniden çalıştır**

- Yeni çalıştırma → Sonuç: **Geçti** ✅
- `SAMP-12` → Durum: `Closed`
- `SAMP-11` → Durum: `Resolved`

**10. İzlenebilirlik kontrolü**

- Kalite → İzlenebilirlik → `SAMP-11` satırı: 🟢 Yeşil

---

### Akış B: Sprint Planlama ve Board İzleme

**Senaryo:** Sprint 3'ü başlatıyorsunuz.

**1. Sprint oluştur**

- Planlama → Döngüler → **+ Yeni Döngü**
- Ad: `Sprint 3` | Başlangıç: Pazartesi | Bitiş: 2 hafta sonra Cuma

**2. Backlog'dan iş kalemi ata**

- Backlog → Filtre: Tür = User Story, Durum = New
- Her User Story'nin Döngü alanı → `Sprint 3`
- Toplu atama da kullanılabilir: hepsini seç → Toplu Atama → Döngü: Sprint 3

**3. Board'u aç**

- Board → Tür: User Story, Döngü: Sprint 3
- Tüm seçilen user story'ler ilk sütunda görünür

**4. Günlük takip**

- Geliştirici sabah Board'u açar → kartını `To Do → In Progress` sütununa taşır
- Gün sonunda tamamlanan kart `Done` sütununa taşınır

**5. Dashboard'dan burndown izle**

- Dashboard → Sprint 3 filtresi → Burndown grafiği günlük güncellenir

---

### Akış C: Yeni Ekip Üyesini Onboarding

**Senaryo:** Test ekibine yeni bir Test Uzmanı katılıyor.

**1. Özel rol oluştur** (ilk kez yapıyorsanız)

- Ayarlar → Roller → **+ Yeni Rol**
- Ad: `Test Uzmanı` | Hiyerarşi: 2
- Yetkiler: `artifact:create`, `artifact:read`, `artifact:update`, `artifact:transition`, `artifact:comment`, `project:read`
- Kaydet

**2. Üyeyi davet et**

- Ayarlar → Üyeler → **+ Davet Et**
- E-posta: `yeni.uzman@sirket.com`
- Rol: `Test Uzmanı`
- **Davet Gönder**

**3. Projeye üye ekle**

- Sample Project → Ayarlar → Üyeler → **Üye Ekle**
- Yeni üyeyi seç → Rol: `Test Uzmanı`
- **Ekle**

**4. Üye giriş yapar**

- Yeni üye davet bağlantısından giriş yapar
- Yalnızca `Test Uzmanı` yetkisi kapsamındaki sayfalar ve işlemler aktif gelir

---

### Akış D: Defect'ten Kaynak Koda Tam İzlenebilirlik

**Senaryo:** Üretimde bir hata var — nereden geldiğini tam olarak bulmak istiyorsunuz.

1. **Defect detayını aç:** `SAMP-12`
2. **Source sekmesi:** Commit `a3f7b9c — SAMP-12: fix post-login redirect` görünür; commit tarihi, yazarı ve PR bağlantısı listelenir
3. **Bağlantılar sekmesi:** Bu Defect'in hangi User Story'ye (`SAMP-11`) ve hangi test senaryosuna bağlı olduğu görünür
4. **Deploy sekmesi:** Bu PR'ın dahil edildiği deployment'lar listelenir — ortam: Production, tarih ve sürüm etiketi
5. **Etki sekmesi:** `SAMP-11`'in bağlı olduğu Epic `SAMP-10`'a kadar tam zincir görünür

---

## Bölüm 15: Kullanım Senaryoları

### UC-01: Gereksinim Yönetimi

| | |
|-|-|
| **Aktör** | Proje Yöneticisi, Ürün Sahibi, Analist |
| **Amaç** | Gereksinimleri hiyerarşik tanımlamak, önceliklendirmek ve izlemek |
| **Tetikleyici** | Proje başlangıcı veya kapsam değişikliği |
| **İlgili Bölümler** | [Bölüm 4](#bölüm-4-backlog-ve-iş-kalemleri), [Bölüm 9](#bölüm-9-izlenebilirlik-ve-etki-analizi) |

**Temel Akış:**
1. Epic ile üst düzey iş paketleri oluşturulur
2. Feature ve User Story'ler Epic altına eklenir
3. Her kalem önceliklendirilir, atanır, sprint'e bağlanır
4. Gereksinimler test senaryolarına bağlanarak kapsama izlenir
5. Backlog'da durum ve ilerleme takibi yapılır

---

### UC-02: Hata Takibi

| | |
|-|-|
| **Aktör** | Test Uzmanı, Geliştirici |
| **Amaç** | Hataları kayıt altına almak ve çözüm sürecini izlemek |
| **Tetikleyici** | Test çalıştırması başarısız olduğunda veya üretimde hata saptandığında |
| **İlgili Bölümler** | [Bölüm 6.4](#64-hata-yönetimi-defects), [Bölüm 14 Akış A](#akış-a-gereksinim--test--hata--düzeltme) |

---

### UC-03: Test Planlaması ve Yürütme

| | |
|-|-|
| **Aktör** | Test Uzmanı, Test Lideri |
| **Amaç** | Test senaryoları hazırlamak, kampanya yürütmek, sonuçları kaydetmek |
| **Tetikleyici** | Sprint başlangıcı veya sürüm hazırlığı |
| **İlgili Bölümler** | [Bölüm 6](#bölüm-6-kalite-ve-test-yönetimi) |

---

### UC-04: Sprint Planlaması

| | |
|-|-|
| **Aktör** | Scrum Master, Proje Yöneticisi |
| **Amaç** | Sprint oluşturmak, iş kalemlerini atamak, ilerlemeyi takip etmek |
| **Tetikleyici** | Yeni sprint döngüsü başlangıcı |
| **İlgili Bölümler** | [Bölüm 8](#bölüm-8-planlama-sprint-ve-sürüm), [Bölüm 14 Akış B](#akış-b-sprint-planlama-ve-board-izleme) |

---

### UC-05: Kanban Board Takibi

| | |
|-|-|
| **Aktör** | Geliştirici, Takım Üyesi |
| **Amaç** | Günlük iş akışını görsel olarak yönetmek |
| **Tetikleyici** | Günlük çalışma başlangıcı |
| **İlgili Bölümler** | [Bölüm 7](#bölüm-7-board-ve-kanban) |

---

### UC-06: İzlenebilirlik Analizi

| | |
|-|-|
| **Aktör** | Proje Yöneticisi, Kalite Güvence Uzmanı |
| **Amaç** | Gereksinim–Test–Hata–Kod–Dağıtım zincirini görüntülemek |
| **Tetikleyici** | Sürüm öncesi kalite kapısı değerlendirmesi |
| **İlgili Bölümler** | [Bölüm 9](#bölüm-9-izlenebilirlik-ve-etki-analizi) |

---

### UC-07: Üye ve Rol Yönetimi

| | |
|-|-|
| **Aktör** | Organizasyon Yöneticisi |
| **Amaç** | Takım üyelerini platforma davet etmek, özel roller oluşturmak |
| **İlgili Bölümler** | [Bölüm 11](#bölüm-11-üye-ve-rol-yönetimi), [Bölüm 14 Akış C](#akış-c-yeni-ekip-üyesini-onboarding) |

---

### UC-08: SCM Entegrasyonu

| | |
|-|-|
| **Aktör** | Geliştirici |
| **Amaç** | Git commit ve PR'ları iş kalemlerine bağlamak |
| **İlgili Bölümler** | [Bölüm 12: SCM Entegrasyonu](#scm-entegrasyonu), [Bölüm 5: Source Sekmesi](#sekme-4-kaynak-kod-source) |

---

### UC-09: Otomasyon Kuralları

| | |
|-|-|
| **Aktör** | Proje Yöneticisi |
| **Amaç** | Tekrarlayan işlemleri otomatikleştirmek |
| **İlgili Bölümler** | [Bölüm 10](#bölüm-10-otomasyon-kuralları) |

---

### UC-10: Denetim Kaydı ve Güvenlik İzleme

| | |
|-|-|
| **Aktör** | Organizasyon Yöneticisi, Güvenlik Sorumlusu |
| **Amaç** | Erişim loglarını görüntülemek, şüpheli girişleri tespit etmek |
| **İlgili Bölümler** | [Bölüm 11: Denetim Kaydı](#denetim-kaydi-audit-log) |

---

## Sık Sorulan Sorular

**S: Silinen bir iş kalemini nasıl geri getirebilirim?**

Backlog'da filtre alanında **"Silinenleri göster"** kutucuğunu işaretleyin. Silinen iş kalemleri kırmızı veya farklı renkte listelenir. Üzerine tıklayıp **Geri Getir** seçeneğini kullanın.

---

**S: Proje kodunu oluşturduktan sonra değiştiremiyorum — ne yapmalıyım?**

Proje kodu kalıcıdır ve değiştirilemez çünkü tüm iş kalemi anahtarları bu koda bağlıdır. Kodu değiştirmek zorundaysanız yeni bir proje oluşturup iş kalemlerini içe aktarmanız gerekir.

---

**S: Bir iş kalemini farklı bir projeye taşıyabilir miyim?**

Mevcut sürümde iş kalemleri projeler arası taşınamaz. Hedef projede yeni iş kalemi oluşturup bağlantı kurabilirsiniz.

---

**S: Board'da kart taşıyamıyorum — neden?**

İki olası neden:
1. **İzin verilmeyen geçiş:** Hedef sütunun durumuna geçiş, manifest'te tanımlı değil. Geçerli geçişleri Manifest sayfasından kontrol edin.
2. **Eksik yetki:** Hesabınızın `artifact:transition` yetkisi olmayabilir. Yöneticinizle iletişime geçin.

---

**S: İzlenebilirlik Matrisi'nde bir gereksinim gri görünüyor — ne yapmalıyım?**

Gri = bu gereksinime hiç test senaryosu bağlanmamış. Kalite → Katalog'da ilgili test senaryosunu açın, Bağlantılar sekmesinden `traces-to` bağlantısı oluşturun.

---

**S: Kayıtlı sorgumu (Saved Query) başka bir kullanıcıyla paylaşabilir miyim?**

Evet. Sorgu kaydederken **Proje** kapsamını seçin — bu şekilde projedeki tüm üyeler sorguyu filtre listesinde görür. **Kişisel** kapsamda kaydedilen sorgular yalnızca size görünür.

---

**S: Komut paleti (`Ctrl+K`) hangi sayfaları buluyor?**

Tüm navigasyon menüsündeki sayfalar, son ziyaret edilen projeler ve hızlı eylemler listelenebilir. Türkçe ve İngilizce arama terimlerinin ikisi de çalışır.

---

**S: Test senaryosu olmadan kampanya oluşturabilir miyim?**

Kampanyayı boş oluşturabilirsiniz; testleri daha sonra ekleyebilirsiniz. Ancak test eklenmeden çalıştırma başlatılamaz.

---

## Sorun Giderme

| Belirti | Olası Neden | Çözüm |
|---------|-------------|-------|
| Giriş yapamıyorum | Hatalı şifre veya e-posta | "Şifremi Unuttum" bağlantısını kullanın |
| Sayfa yüklenmiyor | Bağlantı sorunu | Ağ bağlantınızı kontrol edin, sayfayı yenileyin |
| Board boş geliyor | Tür filtresi seçilmemiş | Filtre panelinde "Tür" seçin |
| "Erişim Yok" sayfası | Hesabınıza gerekli yetki atanmamış | Organizasyon yöneticinize başvurun |
| Kart Board'da taşınmıyor | İzin verilmeyen geçiş veya eksik yetki | Manifest geçişlerini kontrol edin; `artifact:transition` yetkisini doğrulayın |
| İzlenebilirlik Matrisi tüm gri | Testler gereksinime bağlanmamış | Bağlantılar sekmesinden `traces-to` bağlantısı oluşturun |
| Manifest aktifleştirme hatası | Şema doğrulama hatası | YAML hatası vurgulanan satırları düzeltin |
| Source sekmesi boş | Webhook yapılandırılmamış | Proje Ayarları → SCM → Webhook URL'sini alın ve yapılandırın |
| Davet e-postası gelmiyor | SMTP yapılandırılmamış | Yöneticinizden bağlantı URL'sini isteyin |

---

## Sözlük

| Terim | Tanım |
|-------|-------|
| **Artifact** | ALM'de takip edilen her iş kalemi: Epic, User Story, Defect, Task… |
| **Artifact Anahtarı** | Proje kodu + numara: `SAMP-42`. Benzersiz ve kalıcı. |
| **Alan (Area)** | Takım veya ürün bazlı organizasyonel bölüm |
| **Backlog** | Projenin tüm iş kalemlerinin listesi |
| **Board** | Kanban tarzı sütunlu iş yönetimi görünümü |
| **Döngü (Cycle)** | Sprint; belirli tarih aralığındaki iş grubu |
| **Defect** | Yazılımda saptanan hata veya kusur |
| **Epic** | Büyük iş paketi; birden fazla Feature veya User Story içerir |
| **Feature** | Epic altında bir ürün özelliği veya işlev |
| **Kampanya** | Belirli bir sürüm ya da sprint için gruplanmış test senaryoları |
| **Manifest** | Projenin iş kalemi türleri, durumları ve geçiş kurallarını tanımlayan yapılandırma |
| **Organizasyon (Tenant)** | Şirket veya ekip çapında izole çalışma alanı |
| **Saved Query** | Kaydedilmiş filtre kombinasyonu |
| **SCM** | Source Control Management — Git gibi kaynak kod yönetim sistemi |
| **Sprint** | Bkz. Döngü |
| **Story Puanı** | Bir User Story'nin göreli iş büyüklüğünü ifade eden sayısal değer |
| **Sürüm (Release)** | Belirli tarihte teslim edilecek yazılım paketi |
| **Traceability** | Gereksinim → Test → Hata → Kod → Dağıtım zincirinin tam izlenebilirliği |
| **User Story** | Bir kullanıcı ihtiyacını "… yapabilmeli" formatında ifade eden iş kalemi |
| **Webhook** | Belirli bir olay gerçekleştiğinde dış sisteme HTTP POST gönderen mekanizma |
| **Workflow** | İş kaleminin geçebileceği durumların ve aralarındaki geçiş kurallarının tanımı |

---

## Hızlı Başvuru Kartı

### En Sık Kullanılan İşlemler

| İşlem | Yol |
|-------|-----|
| Yeni iş kalemi | Backlog → + Yeni |
| İş kalemini düzenle | Satıra tıkla → detay panelinde alan düzenle |
| Durum değiştir | Detay paneli başlığı → Durum rozetine tıkla |
| Sprint'e ata | Detay paneli → Döngü alanı → seç |
| Test sonucu gir | Kalite → Çalıştırmalar → ilgili satır → ✅/❌/⏸ |
| Hata aç (testten) | Başarısız test satırı → Hata Oluştur |
| Üye davet et | Ayarlar → Üyeler → + Davet Et |
| Filtre kaydet | Backlog filtreleri uygula → Sorgu Kaydet |
| Sayfaya hızlı git | `Ctrl+K` → sayfanın adını yaz |
| Temayı değiştir | Sağ üst avatar → Tema |

### Klavye Kısayolları

| Kısayol | İşlev |
|---------|-------|
| `Ctrl+K` / `Cmd+K` | Komut paletini aç |
| `Esc` | Açık modal veya paneli kapat |
| `Enter` | Satır içi düzenlemeyi onayla |

### İzlenebilirlik Renk Kodları

| Renk | Anlam |
|------|-------|
| 🟢 Yeşil | Bağlı tüm testler geçti |
| 🔴 Kırmızı | En az bir test başarısız |
| 🟡 Sarı | Test bağlı ama sonuç girilmemiş |
| ⚪ Gri | Hiç test bağlanmamış |

### Yetki Hızlı Başvurusu

| Yapmak istediğiniz | Gereken yetki |
|--------------------|---------------|
| İş kalemi oluştur | `artifact:create` |
| İş kalemi gör | `artifact:read` |
| Alanları düzenle | `artifact:update` |
| Durum değiştir | `artifact:transition` |
| Atama yap | `artifact:assign` |
| Yorum ekle | `artifact:comment` |
| Üye davet et | `member:invite` |
| Rol oluştur | `role:create` |
| Manifest aktifleştir | `manifest:activate` |
| Denetim logu gör | `audit:read` |
