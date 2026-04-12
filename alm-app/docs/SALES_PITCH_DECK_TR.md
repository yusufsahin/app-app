# ALM — Satış Pitch Deck Yapısı ve Slayt İçerikleri

Bu doküman 15-20 dakikalık satış sunumu için slayt içeriklerini ve konuşma notlarını içerir. Her slayt başlığı, içerik maddeler ve sunucu notu olarak yapılandırılmıştır.

---

## Kullanım Notları

- Toplam süre: 15-20 dakika sunum + 10-15 dakika soru
- Her slayt için önerilen süre belirtilmiştir
- Konuşma notları sunum sırasında referans olarak kullanılabilir
- Slayt içerikleri PowerPoint, Keynote veya Google Slides'a aktarılabilir

---

## SLAYT 1 — Kapak

**Başlık:** ALM
**Alt başlık:** Manifest tabanlı Application Lifecycle Management

**Görsel öneri:** Platform genel görünümü (dashboard ekran görüntüsü)

**Konuşma notu:**
"Bugün size ALM'i tanıtacağım. ALM, yazılım ekiplerinin backlog, kalite yönetimi ve teslimat izlenebilirliğini tek platformda yönetmesi için geliştirilmiş bir çözüm. Yaklaşık 20 dakikada temel farklılaştırıcıları ve sizin kullanım senaryonuza nasıl uyduğunu birlikte inceleyeceğiz."

---

## SLAYT 2 — Ajanda

**Başlık:** Bu görüşmede

**İçerik:**
1. Problemi çerçeveleyeceğiz (3 dk)
2. ALM'i tanıtacağız (5 dk)
3. Canlı demo (8 dk)
4. Kullanım senaryonuzu değerlendireceğiz (5 dk)

**Konuşma notu:**
"Önce problemi net tanımlayalım. Sonra ALM'in bu probleme nasıl yaklaştığını göstereceğim. En değerli kısım demo; sizin kullanım senaryonuza en yakın akışları göstereceğim. Son olarak da kendi durumunuzu birlikte değerlendireceğiz."

---

## SLAYT 3 — Problem: Araç Parçalanması

**Başlık:** Yazılım yaşam döngüsü verisi çoğu ekipte bu şekilde dağılmış durumda

**İçerik (görsel: araçlar arası kopukluk diyagramı):**

```
Backlog Aracı          Test Yönetimi         Deployment
    │                       │                     │
  Jira               TestRail/Xray           CI/CD Panosu
    │                       │                     │
    └───── Entegrasyon ─────┘                     │
           (bakım gerekli)                         │
                 └──────────── El emeği ───────────┘
```

**Alt madde:**
- Araçlar arası bağ kurmak için entegrasyon veya el emeği gerekiyor
- "Bu gereksinim hangi testle doğrulandı?" sorusu basit cevaplanamıyor
- Sprint görünürlüğü birden fazla kaynak gerektiriyor
- Denetim hazırlığı saatler alıyor

**Konuşma notu:**
"Tanıdık geliyor mu? Çoğu ekip backlog için bir araç, test yönetimi için başka bir araç, deployment takibi için üçüncü bir araç kullanıyor. Bu araçları bağlamak için ya entegrasyon kuruyorsunuz ya da el emeği. İkisi de süregelen bir maliyete dönüşüyor."

---

## SLAYT 4 — Problem: Maliyetin Boyutu

**Başlık:** Bu parçalanmanın gerçek maliyeti ne kadar?

**İçerik:**

**Görünür maliyetler:**
- 2-3 ayrı araç lisansı
- Entegrasyon kurulum ve bakım
- Çoklu kullanıcı yönetimi

**Görünmez maliyetler:**
- Sprint review hazırlığı: ortalama 2-3 saat/sprint → ~60 saat/yıl
- Defect traceability: ortalama 15 dakika/sorgu → günde saatler
- Denetim hazırlığı: her seferinde 2-4 saat
- Araçlar arası geçiş: günlük ~1 saat bağlam kaybı

**Altta:** "40 kişilik bir ekipte yıllık toplam araç + verimlilik maliyeti $15.000-25.000 aralığında olabilir."

**Konuşma notu:**
"Lisans maliyeti görünür. Ama araçlar arası geçiş için harcanan zamanın maliyeti genellikle görünmez. Bu zaman kaybını saatlik maliyetle çarpıp yıla vurduğunuzda rakam sürpriz oluyor."

---

## SLAYT 5 — Çözüm: ALM Yaklaşımı

**Başlık:** ALM: Tek platform, tek veri modeli

**İçerik (görsel: tek platform diyagramı):**

```
         ┌─────────────────────────────────────────┐
         │              ALM Platform               │
         │                                         │
         │  Backlog  ←→  Kalite  ←→  Traceability │
         │     │              │             │      │
         │  Board          Test         SCM Link   │
         │  Planning       Campaign      Deploy    │
         │  Dashboard      Manual Run    Audit     │
         └─────────────────────────────────────────┘
```

**Temel fark:**
- Üç katman → tek veri modeli
- Entegrasyon yok, yerleşik bağlantı
- Manifest ile proje bazlı özelleştirme
- Kurumsal mimari (RBAC, audit, multi-tenant)

**Konuşma notu:**
"ALM üç katmanı tek veri modeline taşıyor: backlog, kalite ve traceability. Entegrasyon köprüsü yok çünkü aynı veritabanından çalışıyor. Ve süreç modeli sabit değil — bir sonraki slayta bakacağız."

---

## SLAYT 6 — Farklılaştırıcı: Manifest Modeli

**Başlık:** Süreçler sabit ekranlara sıkıştırılmaz

**İçerik:**

**Klasik araçlarda:**
- Hazır şablonlar (Agile, Scrum, CMMI)
- Sınırlı özelleştirme
- Ekip süreci araca uyar

**ALM'de:**
- Manifest tabanlı süreç tanımı (YAML/JSON)
- Proje bazında artifact tipler, workflow state'leri, özel alanlar, link tipleri
- Araç sürece uyar

**Görsel:** Manifest editörü ekran görüntüsü

**Konuşma notu:**
"Bu ALM'in en önemli farklılaştırıcısı. Çoğu araç size üç hazır şablon sunar. ALM'de manifest ile kendi sürecinizi tanımlıyorsunuz. Hangi artifact tiplerinin olduğu, workflow geçişlerinin nasıl çalıştığı, hangi alanların olduğu — hepsi bir YAML dosyasında. Kod değişikliği olmadan."

---

## SLAYT 7 — Modül Genel Bakış

**Başlık:** Ne kapsıyor?

**İçerik (2x3 kart düzeni):**

**Kart 1: Backlog & Board**
- Tree ve table görünümü
- Artifact detay paneli
- Kanban board (manifest-driven kolonlar)
- Task, yorum, attachment

**Kart 2: Planning**
- Release / Cycle yapısı
- Area ağacı
- Cycle backlog
- Velocity ve Burndown

**Kart 3: Kalite Yönetimi**
- Test case kataloğu
- Suite ve campaign
- Manual run yürütme
- Defect oluşturma

**Kart 4: Traceability**
- Requirement-test ilişkileri
- SCM linkleri (GitHub, GitLab)
- Deployment event kaydı
- Traceability matrix

**Kart 5: Süreç Motoru**
- Manifest editörü
- Workflow kuralları
- Guard ve ACL
- MPC Studio

**Kart 6: Kurumsal Katman**
- RBAC & yetki yönetimi
- Audit history
- Multi-tenancy
- Rate limiting

---

## SLAYT 8 — Demo Geçişi

**Başlık:** Şimdi platforma bakalım

**İçerik:**

"Demo süresince şu akışı takip edeceğiz:"

1. Dashboard → genel görünürlük
2. Backlog → artifact detayı
3. Planning → sprint/cycle
4. Quality → test case, run, defect
5. Traceability → requirement-test-deploy zinciri
6. Manifest → süreç tanımı

**[DEMO BÖLÜMÜ — 8 dakika]**

*Referans: [DEMO_SCRIPT_TR.md](./DEMO_SCRIPT_TR.md)*

---

## SLAYT 9 — Hedef Profil

**Başlık:** En güçlü uyum sağladığı organizasyonlar

**İçerik:**

**Boyut:**
- Orta ölçekli ekipler (10-200+ geliştirici)
- Birden fazla proje veya ekip
- Dedicated QA kadrosu bulunan yapılar

**İhtiyaç profili:**
- Backlog + test yönetimini tek platformda isteyen ekipler
- Traceability veya compliance gereksinimleri olanlar
- Süreç standardizasyonu arayan organizasyonlar
- Araç parçalanmasını sadeleştirmek isteyenler

**Rol bazında:** PM, QA Lead, Engineering Manager, PMO, Denetim Sorumluları

---

## SLAYT 10 — Konumlandırma

**Başlık:** Mevcut alternatiflere göre ALM nerede duruyor?

**İçerik (karşılaştırma tablosu):**

| | Jira+TestRail | Azure DevOps | Linear | **ALM** |
|---|---|---|---|---|
| Backlog | ✓ | ✓ | ✓ | ✓ |
| Test yönetimi | Eklenti | Ek lisans | ✗ | ✓ Yerleşik |
| Manifest süreç | ✗ | ✗ | ✗ | ✓ |
| Deploy traceability | Sınırlı | Azure-bağlı | ✗ | ✓ |
| Tek platform | ✗ | Kısmen | ✓ | ✓ |
| RBAC + audit | Kısmi | Orta | Temel | ✓ Kapsamlı |

**Konuşma notu:**
"ALM tek araçlı olması açısından Linear'a benziyor. Ama Linear kalite yönetimi kapsamına girmiyor. Jira + TestRail kombinasyonu kapsamlı ama iki araç demek. Azure DevOps kapsamlı ama test yönetimi ek lisans ve Microsoft ekosistemine bağlı. ALM bu boşlukta duruyor: tek platform, kalite yerleşik, süreç uyarlanabilir."

---

## SLAYT 11 — İş Değeri Özeti

**Başlık:** ALM ne değiştirir?

**İçerik:**

**Kısa vadeli (1-3 ay):**
- Araç geçiş zamanı azalır
- QA akışı backlog bağlamına taşınır
- Sprint görünürlüğü konsolide olur

**Orta vadeli (3-12 ay):**
- Entegrasyon bakım yükü düşer
- Audit ve traceability hazırlık süresi kısalır
- Kalite durumu karar süreçlerine erken yansır

**Uzun vadeli (12 ay+):**
- Araç parçalanması kaynaklı süreç kaybı azalır
- Kurumsal bilgi tek platformda konsolide olur
- Süreç olgunluğu artışı ölçülebilir hale gelir

---

## SLAYT 12 — Sonraki Adımlar

**Başlık:** Nereden başlayalım?

**İçerik:**

**Seçenek A — Pilot Proje**
Tek bir projeyle başlayın. 4-6 hafta içinde kendi sürecinizde ALM'i test edin.

**Seçenek B — Keşif Görüşmesi**
Kullanım senaryonuzu daha detaylı inceleyelim. Hangi modüllerin öncelikli olduğunu birlikte belirleyelim.

**Seçenek C — Teknik Değerlendirme**
Mevcut araçlarınızla entegrasyon ve geçiş maliyetini birlikte değerlendirin.

**Alt metin:**
"Bugün en iyi sonraki adım hangisi sizin için?"

---

## SLAYT 13 — İletişim & Kapanış

**Başlık:** ALM

**İçerik:**
- [Demo talep linki]
- [İletişim bilgileri]
- [Satış ekibi e-postası]

**Kapanış cümlesi:**
"Backlog, kalite ve teslimat izlenebilirliğini tek platformda yönetin. Parçalı araç zincirini sadeleştirmek istiyorsanız, doğru yerdesiniz."

---

## Sunum Sonrası Gönderilecek Not

*Referans: [DEMO_SCRIPT_TR.md](./DEMO_SCRIPT_TR.md) — Bölüm 18: Demo Sonrası Takip Notu Şablonu*

---

## Slayt Tasarım Notları

**Renk paleti:**
- Primary: Kurumsal koyu (navy/charcoal)
- Accent: Güven veren mavi
- Highlight: Turuncu veya yeşil (CTA'lar için)

**Font:**
- Başlıklar: Kalın, büyük punto (28-32pt)
- İçerik: Okunabilir, bol boşluk (16-18pt)

**Görsel kaynak önerisi:**
Her demo ekran görüntüsü için FIGMA_DESIGN_BRIEF.md'deki tasarım belgesi kullanılabilir.

**Slayt sayısı:** 13 slayt (demo dahil 15-20 dakika)

---

## İlgili Dokümanlar

- [DEMO_SCRIPT_TR.md](./DEMO_SCRIPT_TR.md) — Detaylı demo akışı
- [ONE_PAGER_TR.md](./ONE_PAGER_TR.md) — Tek sayfa özet
- [COMPETITIVE_POSITIONING_TR.md](./COMPETITIVE_POSITIONING_TR.md) — Rakip karşılaştırma
- [ROI_VALUE_ARGUMENTS_TR.md](./ROI_VALUE_ARGUMENTS_TR.md) — ROI argümanları

↑ [Dokümanlar](README.md)
