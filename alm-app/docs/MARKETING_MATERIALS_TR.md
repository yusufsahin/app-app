# ALM - Marketing Materials

Bu doküman, kod tabanı ve mevcut test akışları incelenerek hazırlanmış, kullanıma hazır pazarlama materyali paketidir.

Amaç:

- Landing page, satış görüşmesi, tanıtım sunumu ve kısa kampanya metinleri için ortak bir mesaj zemini vermek
- Ürünü olduğundan büyük ya da farklı göstermeden güvenli vaat sınırları içinde anlatmak
- Mevcut modülleri tek bir ticari anlatıda toplamak

---

## 1. Ürün Konumu

**ALM**, backlog, planning, quality operasyonu ve traceability ihtiyaçlarını tek bir platformda birleştiren, **manifest tabanlı** bir Application Lifecycle Management çözümüdür.

Ürünün ticari olarak en güçlü anlatısı şudur:

**ALM, ekipleri tek tip süreç kalıbına zorlamadan, iş takibi ile kaliteyi aynı akışta buluşturan ve değişiklikten deploy'a kadar görünürlük sağlayan bir yönetim platformudur.**

Bu konumlandırmada üç eksen öne çıkar:

- Süreç esnekliği: Manifest ile workflow, artifact type ve link yapıları tanımlanabilir.
- Operasyon bütünlüğü: Backlog, board, planning ve quality aynı ürün içinde çalışır.
- İzlenebilirlik: Requirement, defect, SCM linkleri ve deployment olayları aynı bağlamda görünür hale gelir.

---

## 2. Kimin İçin En Uygun?

En güçlü hedef segmentler:

- Birden fazla proje ve ekibi aynı yönetişim modelinde toplamak isteyen kurumlar
- Backlog ile QA/test operasyonunu ayrı araçlarda yürüten ekipler
- Requirement, defect, commit, merge request ve deployment arasında görünürlük isteyen engineering management yapıları
- Süreç standardizasyonu ile esneklik arasında denge arayan ürün ve teslimat organizasyonları
- Denetim, rol/yetki ve audit beklentisi olan kurumsal ekipler

En güçlü buyer / kullanıcı profilleri:

- Head of Engineering
- QA Manager / Test Lead
- PMO / Delivery Manager
- Product Operations
- Platform / Transformation ekipleri

---

## 3. Çözdüğü Temel Problemler

- İş takibi, kalite ve teslimat sinyallerinin farklı araçlara dağılması
- Takımlar arası süreç farklılıkları yüzünden tek araçta ölçeklenemeyen operasyon
- Defect'in hangi testten çıktığı, hangi değişiklikle ilişkili olduğu ve hangi ortama taşındığı bilgisinin dağınık kalması
- Planning, board ve backlog görünürlüğünün kalite verisinden kopuk olması
- Çok kiracılı yapıda rol, yetki ve audit kontrolünün zayıf kalması

---

## 4. Kodla Desteklenen Ana Mesajlar

### Mesaj 1: Süreç ürüne değil, ürün sürece uyum sağlar

ALM'in en net farkı, manifest tabanlı yapısı sayesinde workflow, artifact type, link type ve politika tanımlarını proje bağlamında yönetebilmesidir.

Ne söyleyin:

- "Süreçlerinizi tek tip ekran kalıbına sıkıştırmadan yönetin."
- "Workflow ve artifact modelini proje ihtiyacına göre tanımlayın."
- "Board, backlog ve quality akışlarını manifest ile hizalayın."

### Mesaj 2: Quality sonradan eklenmiş bir modül değil, ürünün merkezindedir

Quality tarafında katalog, campaign, runs, manual execution, traceability ve defect akışları ayrı sayfalar ve test senaryoları ile mevcut.

Ne söyleyin:

- "Test yönetimini backlog'tan koparmadan yürütün."
- "Campaign, run ve execution akışlarını aynı platform içinde yönetin."
- "Testten defect'e geçişi doğal iş akışı olarak kurgulayın."

### Mesaj 3: Traceability sadece rapor değil, çalışma bağlamıdır

SCM webhook akışları, artifact source paneli, unmatched event triage ve deploy webhook yapısı ALM'i klasik issue tracker çizgisinin ötesine taşır.

Ne söyleyin:

- "Requirement, defect, PR/MR ve deployment bilgisini aynı bağlamda görün."
- "Kod ve teslimat etkisini artifact düzeyinde takip edin."
- "SCM ve deployment sinyallerini iş takibine bağlayın."

### Mesaj 4: Kurumsal kullanım için kontrol katmanı hazırdır

Tenant ayrımı, rol/yetki yönetimi, access audit, admin akışları ve güvenlik middleware katmanları kurumsal konumlandırmayı destekler.

Ne söyleyin:

- "Çok kiracılı yapı ve rol bazlı erişim modeli ile yönetişimi güçlendirin."
- "Üyelik, rol ve erişim görünürlüğünü merkezi olarak yönetin."
- "Audit beklentisi olan organizasyonlar için daha kontrollü bir çalışma zemini kurun."

---

## 5. En Güçlü Farklaştırıcılar

- **Manifest tabanlı süreç modeli:** Süreç tasarımı ürünün dışında değil, ürünün içinde yaşar.
- **Backlog + Quality + Traceability birlikteliği:** Bu üçlü aynı veri ve gezinme modelinde bir araya gelir.
- **Planning derinliği:** Release, cycle ve area yapıları backlog ile birlikte çalışır.
- **SCM ve deploy bağlamı:** GitHub, GitLab ve deploy webhook uçlarıyla değişiklik zinciri genişler.
- **Kurumsal çerçeve:** Tenant, RBAC, audit ve güvenlik başlıkları yalnızca doküman değil, kod seviyesinde de bulunur.

---

## 6. 30 Saniyelik Pitch

ALM, backlog yönetimi, planning, quality operasyonu ve traceability'yi tek platformda birleştiren manifest tabanlı bir ALM çözümüdür. Ekipleri tek tip süreç kalıbına zorlamaz; workflow ve artifact modelini projeye göre tanımlamaya izin verir. Aynı zamanda testten defect'e, commit'ten deploy'a kadar uzanan görünürlük sağlayarak dağınık araç zincirini sadeleştirir.

---

## 7. 90 Saniyelik Satış Anlatısı

Birçok ekip backlog'u bir araçta, test operasyonunu başka bir araçta, teslimat ve SCM görünürlüğünü ise dağınık entegrasyonlarla yönetiyor. Bu yapı hem koordinasyonu yavaşlatıyor hem de izlenebilirliği zayıflatıyor.

ALM burada farklılaşıyor. Çünkü yalnızca bir issue tracker sunmuyor. Manifest tabanlı süreç modeli sayesinde workflow ve artifact yapısını proje ihtiyacına göre tanımlayabiliyor. Backlog, board ve planning ekranları günlük operasyonu yönetirken; quality workspace, campaign, runs ve manual execution akışları kalite operasyonunu aynı bağlamın içine alıyor. Üstüne SCM linkleri ve deploy webhook yapısı eklendiğinde ekipler bir iş kaleminin sadece durumunu değil, kod ve teslimat etkisini de görebiliyor.

Özellikle çok takımlı, süreç standardizasyonu arayan ve kaliteyi teslimat zincirine daha yakın taşımak isteyen organizasyonlar için güçlü bir adaydır.

---

## 8. Landing Page İçin Hazır Kopya

### Hero başlık seçenekleri

- **Backlog, kalite ve traceability için tek çalışma zemini**
- **Yazılım yaşam döngüsünü dağınık araçlardan tek platforma taşıyın**
- **Manifest tabanlı ALM ile süreci standartlaştırın, esnekliği kaybetmeyin**

### Hero alt başlık

ALM; backlog, board, planning, quality test management ve SCM/deploy traceability ihtiyaçlarını tek ürün içinde birleştirir. Ekipleri tek tip sürece zorlamadan, proje bazlı iş akışlarıyla daha görünür bir teslimat modeli kurmanıza yardımcı olur.

### CTA seçenekleri

- Demo isteyin
- Örnek kullanım akışını görün
- Quality ve traceability senaryosunu inceleyin

### Değer önerisi kartları

- **Manifest tabanlı süreç yönetimi**  
  Workflow, artifact ve link modelini proje ihtiyacına göre tanımlayın.

- **Quality operasyonunu merkezileştirin**  
  Catalog, campaign, runs ve manual execution akışlarını backlog ile aynı platformda yönetin.

- **SCM ve deploy görünürlüğü kazanın**  
  PR, MR ve deployment olaylarını artifact bağlamına taşıyarak izlenebilirliği artırın.

---

## 9. Satış Sunumu İçin 5 Slaytlık Omurga

### Slayt 1 - Problem

Backlog, QA ve teslimat görünürlüğü farklı araçlarda dağınık. Bu yüzden süreç yönetimi ile kalite verisi aynı karar zemininde buluşmuyor.

### Slayt 2 - Çözüm

ALM, manifest tabanlı süreç modeli ile backlog, planning, board, quality ve traceability akışlarını tek platformda birleştirir.

### Slayt 3 - Ürün Yetkinlikleri

- Backlog ve artifact yönetimi
- Release/cycle/area planning
- Board ve workflow transition
- Quality catalog, campaign, runs, manual execution
- SCM ve deploy traceability
- Tenant, RBAC ve audit

### Slayt 4 - Neden Farklı?

ALM sadece iş takibi değil; kalite ve teslimat zincirini de aynı çalışma modeline dahil eder.

### Slayt 5 - Uygun Kullanım Alanları

Çok projeli organizasyonlar, kalite operasyonu görünürlüğü arayan ekipler ve süreç standardizasyonunu kontrollü biçimde yapmak isteyen kurumlar.

---

## 10. Demo Açılış Metni

Bugün size klasik bir issue tracker değil, süreç, kalite ve teslimat görünürlüğünü aynı zeminde toplayan bir ALM yaklaşımı göstereceğim. Önce backlog ve planning tarafını göreceğiz, ardından quality workspace'e geçip campaign ve run akışını inceleyeceğiz. Son olarak bir artifact'in kod ve deployment bağlamıyla nasıl ilişkilendiğini göstereceğim.

---

## 11. Satış E-postası Taslağı

Konu: Backlog, kalite ve traceability'yi tek platformda toplamak için kısa bir değerlendirme

Merhaba,

Birçok ekip backlog yönetimi, test operasyonu ve teslimat görünürlüğünü farklı araçlarda yürütüyor. Bu yapı hem koordinasyonu zorlaştırıyor hem de requirement-defect-commit-deploy ilişkisini görünmez hale getiriyor.

ALM, bu parçalı yapıyı sadeleştirmek için geliştirilen manifest tabanlı bir yönetim platformu. Backlog, board, planning, quality test management ve SCM/deploy traceability akışlarını aynı ürün içinde topluyor. Özellikle çok projeli yapılarda süreç standardizasyonu ile esnekliği birlikte korumak isteyen ekipler için anlamlı bir seçenek oluşturuyor.

Uygun olursa, size 20-30 dakikalık bir oturumda backlog + quality + traceability senaryosunu gösterebilirim.

---

## 12. LinkedIn / Kısa Tanıtım Postu

Yazılım ekiplerinin en yaygın problemlerinden biri, backlog, kalite ve teslimat verisinin farklı araçlara dağılması. ALM bu parçalı yapıyı manifest tabanlı bir yaklaşımla sadeleştiriyor. Backlog, board, planning, quality test management ve SCM/deploy traceability aynı platform içinde çalışıyor. Özellikle süreç esnekliği ile kurumsal kontrolü birlikte arayan ekipler için dikkat çekici bir model sunuyor.

---

## 13. Güvenli Vaat Sınırları

Güvenle söyleyin:

- Manifest tabanlı workflow ve artifact modelleme mevcut
- Backlog, board ve planning akışları mevcut
- Quality catalog, campaign, runs ve manual execution akışları mevcut
- SCM webhook ve deploy webhook akışları mevcut
- Tenant, rol/yetki ve audit yönetimi mevcut

Daha dikkatli çerçeveleyin:

- Geniş kapsamlı no-code otomasyon iddiası
- Tam ölçekli CI/CD platformu gibi konumlandırma
- İleri seviye forecast ve kapasite planlamasını ürünün ana vaadi haline getirme
- Tüm kurumsal senaryolar için hazır, uçtan uca governance çözümü iddiası

---

## 14. Bu Materyalin Dayandığı Kod Sinyalleri

Bu paket hazırlanırken özellikle şu alanlar doğrulandı:

- Frontend route yapısı: dashboard, backlog, planning, board, quality, manifest, automation, settings
- Quality modülleri: catalog, campaign, runs, defects, traceability, manual execution
- Planning modülleri: release, cycle, area tree ve cycle backlog
- Manifest modülü: source editor, YAML/JSON dönüşümü, studio entegrasyonu
- SCM/deploy görünürlüğü: GitHub, GitLab ve deploy webhook ekranları ile source paneli
- Backend modülleri: org router altında quality, coverage, SCM links, deployment events, workflow rules ve traceability uçları
- E2E senaryoları: artifact flow, planning, quality campaign, execution, SCM traceability

Bu yüzden yukarıdaki anlatı, ürünün mevcut kod yüzeyiyle uyumlu bir pazarlama zemini sunar.

---

## 15. İlgili Dokümanlar

- [MARKETING_MESSAGE_FRAMEWORK_TR.md](./MARKETING_MESSAGE_FRAMEWORK_TR.md)
- [LANDING_PAGE_COPY_TR.md](./LANDING_PAGE_COPY_TR.md)
- [ONE_PAGER_TR.md](./ONE_PAGER_TR.md)
- [DEMO_SCRIPT_TR.md](./DEMO_SCRIPT_TR.md)

- ↑ [Dokümanlar](README.md)
