# ALM - Demo Senaryosu

Bu doküman satış, keşif görüşmesi veya ürün tanıtımı için demo akışını tanımlar. Senaryo mevcut ürün kabiliyetlerine dayanır ve abartılı vaatlerden kaçınır.

---

## 1. Demo Amacı

İzleyiciye şu üç mesajı net biçimde vermek:

- ALM yalnızca backlog aracı değildir; kalite ve traceability aynı platformdadır.
- Süreç modeli sabit değildir; manifest tabanlı olarak uyarlanabilir.
- Proje, kalite ve teslimat görünürlüğü tek bağlamda izlenebilir.

---

## 2. Hedef Kitleye Göre Ana Vurgu

### PM / Product Owner

- Backlog, planning, board ve dashboard görünürlüğü

### QA / Test Lead

- Test case, suite/campaign, manual run, defect akışı

### Engineering Manager / Delivery Lead

- Traceability, audit, SCM ve deployment görünürlüğü

### Kurumsal karar verici

- Tenant, RBAC, audit ve süreç uyarlanabilirliği

---

## 3. Demo Öncesi Hazırlık

### Mutlaka hazır olması gereken veri

- En az bir organizasyon
- En az bir örnek proje
- Backlog'da birkaç artifact
- En az bir release ve cycle
- Quality ağacında test case ve test suite
- En az bir test run
- En az bir defect

### Güçlü demo için önerilen ek veri

- Bir artifact üzerinde SCM linkleri
- Aynı artifact için deployment traceability verisi
- Audit geçmişi olan birkaç kayıt
- Board üzerinde farklı durumlarda kartlar

### Teknik hazırlık

- Demo hesabı giriş bilgileri hazır olmalı
- Tarayıcı sekmeleri önceden düzenlenmeli
- Gerekirse canlı internet bağımlılığı olmayan örnek veri tercih edilmeli

---

## 4. Demo Akışı

Toplam önerilen süre: 20 ila 30 dakika

---

## 5. Bölüm 1 - Açılış ve Konumlandırma

### Süre

2 dakika

### Göster

- Projeler veya dashboard ekranı

### Söyle

"ALM'i klasik iş takip araçlarından farklılaştıran nokta, backlog, kalite ve traceability katmanlarını tek omurgada birleştirmesi. Bugün size bunu tek bir akış içinde göstereceğim."

### Hedef mesaj

Ürün kategorisini baştan doğru çerçevelemek.

---

## 6. Bölüm 2 - Dashboard ile Genel Görünürlük

### Süre

3 dakika

### Göster

- Dashboard
- KPI kartları
- Velocity
- Burndown
- Activity akışı

### Söyle

"Yönetim katmanında ilk ihtiyaç genel görünürlüktür. Burada proje, backlog, task ve açık defect sayılarını görüyoruz. Aynı ekranda velocity, burndown ve son aktivite akışı da var."

### Kanıt

- Dashboard kartları
- Grafikler
- Activity listesi

---

## 7. Bölüm 3 - Backlog ve Artifact Detayı

### Süre

4 dakika

### Göster

- Backlog görünümü
- Bir artifact detay paneli
- Tasks, Links, Source, Deploy, Impact, Audit sekmeleri

### Söyle

"ALM'in operasyonel çalışma alanı backlog tarafında başlıyor. Ancak detay paneline girdiğimizde yalnızca başlık ve durum değil; task ilişkileri, yorumlar, dosyalar, kaynak kod bağlantıları, deployment izleri ve audit geçmişi de aynı bağlamda görünüyor."

### Hedef mesaj

Backlog deneyiminin yüzeysel olmadığını göstermek.

### Vurgu cümlesi

"Burada önemli olan şey, yaşam döngüsü bilgisinin artifact merkezli olarak toplanması."

---

## 8. Bölüm 4 - Planning

### Süre

3 dakika

### Göster

- Planning sayfası
- Release ve cycle ağacı
- Area ağacı
- Cycle backlog

### Söyle

"Planning tarafında release, cycle ve area yapısını ayrı ayrı yönetebiliyoruz. Bu, yalnızca listeleme değil; backlog'un zaman eksenine ve organizasyonel alana oturtulmasını sağlıyor."

### Kanıt

- Cycle oluşturma veya mevcut cycle'ları gösterme
- Bir artifact'i cycle'a bağlı gösterme

---

## 9. Bölüm 5 - Board

### Süre

3 dakika

### Göster

- Board sayfası
- Durum kolonları
- Kart sürükle bırak
- Filtreler

### Söyle

"Board tarafı manifest'teki workflow durumlarını doğrudan kullanıyor. Yani gördüğünüz kolonlar sabit bir kanban şablonu değil; projenin süreç modelinin yansıması."

### Hedef mesaj

Süreç uyarlanabilirliğini kullanıcı deneyimi üzerinden göstermek.

---

## 10. Bölüm 6 - Kalite Çalışma Alanı

### Süre

6 dakika

### Göster

- Quality ana sayfası
- Catalog
- Test suite veya campaign
- Runs hub

### Söyle

"Kalite burada ayrı bir ürün gibi durmuyor. Test case kataloğu, suite yapısı, run merkezi ve defect akışı aynı platformun içinde."

### Ardışık demo akışı

1. Test case kataloğunu aç
2. Bir test case detayını göster
3. Suite veya campaign yapısını göster
4. Runs hub'a geç
5. Var olan bir run'ı aç

---

## 11. Bölüm 7 - Manual Execution ve Defect Oluşturma

### Süre

5 dakika

### Göster

- Manual execution player
- Adım bazlı geçme/kalma
- Başarısız adımdan defect oluşturma

### Söyle

"Burada test yürütme gerçekten operasyonel. Adım bazında ilerleyebiliyor, sonucu kaydedebiliyor ve başarısız adımı anında defect'e dönüştürebiliyoruz."

### Vurgu

"Bu nokta önemli: kalite yönetimi iş takibinin dışına taşmıyor."

### Kanıt

- Step sonuçları
- Defect oluşturma diyaloğu
- Oluşan defect'in backlog/quality akışında görünmesi

---

## 12. Bölüm 8 - Traceability

### Süre

4 dakika

### Göster

- Requirement veya defect detayındaki Source sekmesi
- Deploy sekmesi
- Quality traceability veya requirement traceability ekranı

### Söyle

"Bu artifact için hangi kod bağlantıları oluşmuş, hangi ortamlara kadar iz bırakmış, burada görebiliyoruz. Eğer ekip SCM webhook ve deployment event akışını kullanıyorsa, backlog ile teslimat zinciri arasındaki görünürlük ciddi şekilde artıyor."

### Hedef mesaj

ALM'in yalnızca planlama ve test değil, teslim görünürlüğü de sunduğunu göstermek.

### Dikkat

Bu bölüm demo verisine bağlıysa, önceden mutlaka seed edilmiş örnek gösterilmeli.

---

## 13. Bölüm 9 - Manifest ve Uyarlanabilir Süreç

### Süre

3 dakika

### Göster

- Manifest sayfası
- JSON/YAML source
- Overview
- MPC Studio sekmesi

### Söyle

"ALM'in en kritik farklarından biri burada. Süreç modeli ürün içinde tanımlanabiliyor. Artifact türleri, workflow'lar, özel alanlar ve link tipleri proje ihtiyaçlarına göre düzenlenebiliyor."

### Hedef mesaj

Ürünün konfigürasyon kabiliyetini somut göstermek.

### Güvenli sınır

Demo sırasında canlı değişiklik yapmanız gerekmiyorsa yalnızca mevcut manifest'i göstermek daha güvenlidir.

---

## 14. Bölüm 10 - Audit ve Kurumsal Katman

### Süre

2 dakika

### Göster

- Audit sekmesi veya audit history
- Settings içindeki member/role yapısı

### Söyle

"Kurumsal ortamlarda yalnızca iş akışı değil, kontrol katmanı da önemlidir. Tenant bazlı yapı, rol/yetki ve audit geçmişi bu ihtiyacı destekliyor."

---

## 15. Kapanış Konuşması

### 30 saniyelik kapanış

"Özetle ALM, backlog yönetimini kalite ve traceability katmanlarıyla birleştiriyor. Süreçler sabit değil, manifest ile uyarlanabiliyor. Bu nedenle özellikle parçalı araç zincirini sadeleştirmek ve yaşam döngüsü görünürlüğünü artırmak isteyen ekipler için güçlü bir aday."

---

## 16. Soru Gelirse Verilecek Kısa Cevaplar

### Bu ürün yalnızca test yönetimi için mi?

Hayır. Test yönetimi güçlü bir modül ama ürünün çekirdeği ALM yaklaşımıdır.

### Süreçler özelleştirilebilir mi?

Evet. Manifest tabanlı yapı ile workflow ve metadata katmanı proje bazında düzenlenebilir.

### Kod ve deployment tarafı görülebiliyor mu?

Evet. SCM linkleri ve deployment traceability özeti destekleniyor.

### Kurumsal kullanım için neler var?

Tenant ayrımı, RBAC, audit ve süreç bazlı erişim kontrolü bulunuyor.

---

## 17. Demo Sırasında Kaçınılması Gereken İddialar

- Capacity forecasting hazır
- Çok gelişmiş no-code otomasyon platformu
- Uçtan uca CI/CD çözümü
- Tüm kullanım senaryoları sıfır eforla self-service kurulur

---

## 18. Demo Sonrası Takip Notu Şablonu

Toplantı sonrası gönderilebilecek kısa özet:

"Bugünkü görüşmede ALM'in backlog, quality ve traceability katmanlarını tek platformda nasıl birleştirdiğini paylaştık. Özellikle manifest tabanlı süreç modeli, manual run + defect akışı ve artifact bazlı SCM/deployment görünürlüğü sizin kullanım senaryonuz açısından öne çıktı. İsterseniz bir sonraki adımda kendi süreçlerinize göre odaklı bir demo hazırlayabiliriz."

---

## 19. İlgili Dokümanlar

- [MARKETING_MESSAGE_FRAMEWORK_TR.md](./MARKETING_MESSAGE_FRAMEWORK_TR.md)
- [LANDING_PAGE_COPY_TR.md](./LANDING_PAGE_COPY_TR.md)
- [ONE_PAGER_TR.md](./ONE_PAGER_TR.md)
- [USER_TUTORIAL_TR.md](./USER_TUTORIAL_TR.md)

- ↑ [Dokümanlar](README.md)
