# ALM - Pazarlama Mesaj Çatısı

Bu doküman ALM ürününün pazarlama, satış ve demo dilini aynı eksende toplamak için hazırlanmıştır. Metinler mevcut ürün kabiliyetlerine dayanır; roadmap öğeleri ana vaat olarak kullanılmaz.

---

## 1. Kısa Konumlandırma

**ALM**, yazılım ekipleri için backlog, kalite, süreç yönetimi ve teslimat izlenebilirliğini tek omurgada birleştiren manifest tabanlı bir Application Lifecycle Management platformudur.

Klasik iş takip araçlarının aksine süreçleri sabit ekranlara zorlamaz; artifact tipleri, workflow kuralları, link tipleri ve erişim mantığı proje ihtiyaçlarına göre tanımlanabilir.

---

## 2. Kimler İçin?

### Ana hedef müşteri profili

- Orta ve büyük ölçekli yazılım ekipleri
- Birden fazla proje veya ekip yöneten organizasyonlar
- Test yönetimi ile iş takibini aynı platformda toplamak isteyen yapılar
- Gereksinim, test, defect, kod ve deployment arasındaki bağı görünür kılmak isteyen ekipler
- Denetim, kalite kapısı veya süreç standardizasyonu ihtiyacı olan kurumlar

### Ana persona'lar

- Ürün Sahibi / Proje Yöneticisi
- QA Lead / Test Yöneticisi
- Engineering Manager
- PMO / Delivery Lead
- Regülasyon veya iç denetim sorumluları

---

## 3. Temel Problemler

ALM'in konuştuğu ana problemler:

- Backlog, test yönetimi ve teslimat bilgisi farklı araçlarda dağınık kalıyor.
- Takımlar süreci araca uyduruyor; araç sürece uymuyor.
- Gereksinimden teste, defect'ten commit'e ve deployment'a kadar uçtan uca izlenebilirlik kurulamıyor.
- Sprint, release ve kalite görünürlüğü tek ekranda toplanamıyor.
- Yetki, audit ve süreç kuralı katmanı sonradan ve parça parça ekleniyor.

---

## 4. Temel Değer Önerisi

### Birincil değer önerisi

ALM, yazılım yaşam döngüsünü yönetmek için gereken planlama, iş takibi, kalite ve traceability katmanlarını tek platformda toplar.

### İkincil değer önerisi

ALM'in süreç modeli hard-code değildir. Manifest tabanlı yapı sayesinde artifact türleri, workflow'lar, özel alanlar, link tipleri ve kalite ağaçları proje bazında şekillendirilebilir.

### Üçüncül değer önerisi

Kalite ve teslimat izlenebilirliği iş takibinin yanına sonradan eklenen bir eklenti gibi değil, ürünün doğal parçası olarak çalışır.

---

## 5. Mesaj Hiyerarşisi

### Ana mesaj

**Backlog, kalite ve teslimat izlenebilirliğini tek ALM omurgasında yönetin.**

### Destekleyici mesaj 1

**Süreçlerinizi araca değil, aracı sürecinize uyarlayın.**
Manifest tabanlı yapı ile workflow, artifact tipi, özel alanlar ve link ilişkileri proje ihtiyacına göre tanımlanır.

### Destekleyici mesaj 2

**Kalite yönetimini backlog'dan koparmayın.**
Test case kataloğu, suite/campaign yapısı, manual run ve defect akışı aynı ürün içinde yer alır.

### Destekleyici mesaj 3

**Gereksinimden deploy'a kadar bağlantıyı görünür yapın.**
SCM linkleri, deployment events ve artifact bazlı traceability özeti ile değişikliğin nereye gittiği takip edilir.

### Destekleyici mesaj 4

**Kurumsal kontrol katmanını baştan kurun.**
Rol/yetki, audit geçmişi, tenant ayrımı ve süreç bazlı erişim kontrolü ürünün çekirdeğindedir.

---

## 6. Kanıt Cümleleri

Pazarlama ve satışta kullanılabilecek doğrulanmış kanıt başlıkları:

- Organizasyon, proje, üye, rol ve yetki yönetimi mevcut.
- Backlog, artifact detay paneli, task, yorum, ek dosya ve board akışları çalışıyor.
- Release, cycle ve area bazlı planning ile velocity ve burndown ekranları mevcut.
- Test case, test suite, test campaign, test run ve manual execution akışı mevcut.
- Test run içinden defect oluşturma akışı bulunuyor.
- Requirement, quality ve defect ilişkileri için link tabanlı traceability ekranları var.
- GitHub ve GitLab webhook entegrasyonları ile commit ve PR bağlantıları alınabiliyor.
- Deployment event kaydı ve artifact bazlı deploy + SCM özeti mevcut.
- Audit history, WebSocket tabanlı canlı güncelleme ve tenant bazlı rate limit katmanı bulunuyor.
- Manifest editörü JSON/YAML ve gömülü MPC Studio ile sunuluyor.

---

## 7. Farklılaştırıcılar

### 1. Manifest tabanlı süreç yönetimi

Birçok araçta süreç özelleştirme sınırlı veya karmaşıktır. ALM'de süreç modeli ürünün merkezindedir.

### 2. Backlog + kalite + traceability birleşimi

Test yönetimi ve teslimat izlenebilirliği ayrı modül veya üçüncü parti bağımlılık gibi değil, çekirdek kullanım senaryosunun içindedir.

### 3. Operasyonel görünürlük

Dashboard, board, planning, audit, SCM ve deploy görünürlüğü tek iş akışı içinde konumlanır.

### 4. Kurumsal yapı

Tenant ayrımı, RBAC, audit ve süreç bazlı erişim kontrolü sayesinde ürün kurumsal senaryolara daha yakın durur.

---

## 8. Kullanılacak Dil

### Söylenmesi önerilen ifade kalıpları

- Manifest tabanlı ALM
- Uçtan uca yazılım yaşam döngüsü görünürlüğü
- Backlog ile kaliteyi tek akışta birleştiren yapı
- Gereksinimden teste, defect'ten commit'e ve deploy'a traceability
- Süreçleri proje bazında uyarlayabilen platform

### Kaçınılması gereken ifade kalıpları

- Her türlü süreç için hazır, sınırsız no-code platform
- Tam CI/CD platformu
- Tüm kurumsal ihtiyaçları kutudan çıktığı gibi karşılar
- Gelişmiş kapasite planlama ve forecast hazır
- Tüm ürün tamamen iki dilli veya globalized

Not: Capacity ve ileri tahminleme dokümanlarda roadmap olarak bulunuyor; satış mesajında ana vaat yapılmamalı.

---

## 9. Kısa Pitch Metinleri

### 15 saniyelik pitch

ALM, backlog, kalite yönetimi ve teslimat izlenebilirliğini tek platformda birleştiren manifest tabanlı bir yazılım yaşam döngüsü çözümüdür.

### 30 saniyelik pitch

ALM, yazılım ekiplerinin iş takibini, test operasyonunu ve teslimat görünürlüğünü tek omurgada yönetmesini sağlar. Backlog, board, planning, test case ve run yönetimi, defect akışı, SCM bağlantıları ve deployment traceability aynı ürün içinde yer alır. Üstelik süreç modeli sabit değildir; manifest tabanlı yapı sayesinde proje ihtiyaçlarına göre uyarlanır.

### 60 saniyelik pitch

Birçok ekip backlog, test yönetimi, izlenebilirlik ve teslimat görünürlüğünü farklı araçlar arasında yürütüyor. Bu da süreç kaybı, kopuk veri ve denetim zorluğu yaratıyor. ALM bu parçalı yapıyı tek platformda toplar. Organizasyon ve proje yapısı, artifact yönetimi, kanban board, release-cycle planning, kalite kataloğu, campaign ve manual run akışı, defect yönetimi, SCM linkleri ve deployment event izlenebilirliği aynı ürün içinde çalışır. En kritik farkı ise süreçleri araca zorlamak yerine, manifest tabanlı model ile aracı sürecinize uyarlamasıdır.

---

## 10. Slogan Adayları

- Yazılım yaşam döngüsünü tek omurgada yönetin.
- Backlog'dan kaliteye, commit'ten deploy'a tek görünürlük.
- Sürecinizi tanımlayın, akışınızı yönetin.
- Kalite ve traceability odaklı yeni nesil ALM.
- Planlama, kalite ve teslimat için birleşik ALM platformu.

---

## 11. Satışta Kullanılabilecek Örnek Açılış Soruları

- Backlog, test yönetimi ve release görünürlüğü bugün kaç farklı araçta dağınık?
- Bir gereksinimin hangi testlerle doğrulandığını ve hangi deployment ile çıktığını tek ekranda görebiliyor musunuz?
- Süreçlerinizi araca uyduruyor musunuz, yoksa araç süreçlerinize uyuyor mu?
- QA akışı ile iş takibi aynı veri modelinde mi, yoksa sonradan bağlanmış iki ayrı dünya mı?

---

## 12. İlgili Dokümanlar

- [LANDING_PAGE_COPY_TR.md](./LANDING_PAGE_COPY_TR.md)
- [ONE_PAGER_TR.md](./ONE_PAGER_TR.md)
- [DEMO_SCRIPT_TR.md](./DEMO_SCRIPT_TR.md)
- [GAP_ANALYSIS_ALM.md](./GAP_ANALYSIS_ALM.md)
- [QUALITY_SUITE.md](./QUALITY_SUITE.md)

- ↑ [Dokümanlar](README.md)
