# Yönetici Özeti (Executive Brief)

**Hedef:** CEO, Genel Müdür, CTO, Yönetim Kurulu Üyesi
**Okuma süresi:** 3 dakika
**Format:** Karar odaklı, özellik yok, iş değeri ön planda

> **Sunum notu:** Bu belgeyi karşı tarafa verirken ürün adıyla değil, çözdüğü problemle açın.
> "Yazılım geliştirme süreçlerinizi birleştiren bir platform getirdim" — bu cümle kapıyı açar.
> "ALM getirdim" demek, dinleyicinin zihninde yanlış bir referans noktası yaratabilir.

---

## Tek Sayfalık Özet

---

### Problem

Yazılım geliştiren her organizasyonda üç kritik iş süreci vardır:

1. **Ne yapılacak?** — İş gereksinimlerini planlama ve yönetme
2. **Ne kadar iyi?** — Kalite güvencesi ve test yönetimi
3. **Nereye gitti?** — Değişikliklerin müşteriye ne zaman, nasıl ulaştığını izleme

Bu üç sürecin farklı araçlarda, farklı ekiplerde ve kopuk veri modelleriyle yürütülmesi organizasyonlara **üç somut iş riski** getirir:

**Risk 1 — Görünürlük kaybı**
Yönetim "bu özellik ne zaman çıkacak?" veya "kalite durumu nedir?" sorduğunda cevap toplamak saatler alıyor. Karar gecikmesi, sprint kaybı ve müşteriye yanlış beklenti yaratma riski.

**Risk 2 — Maliyet parçalanması**
Ortalama bir yazılım ekibi bu üç süreç için 3-4 farklı araç lisansı alıyor. Araçlar arası entegrasyon bakımı, veri senkronizasyonu ve çift girişin gizli maliyeti lisans ücretinin üstüne biniyor.

**Risk 3 — Denetim ve uyum açığı**
"Bu gereksinim hangi testlerle doğrulandı?" veya "bu değişiklik hangi ortama kadar gitti?" sorularını yanıtlamak el emeği gerektiriyorsa, denetim hazırlığı her seferinde ayrı bir proje haline geliyor.

---

### Çözüm

Yazılım geliştirme yaşam döngüsünün bu üç kritik katmanını — planlama, kalite ve teslimat izlenebilirliği — **tek platformda** birleştiren bir yazılım geliştirme yönetim platformu.

Rakiplerinden farkı:

- Kalite yönetimi eklenti değil, ürünün çekirdeği — ayrı araç, ayrı lisans yok
- Süreç modeli sabit şablona zorlamaz; her projenin ihtiyacına göre yapılandırılır
- Gereksinimden teslimat kanıtına kadar uçtan uca izlenebilirlik tek bağlamdan okunur

*Ürün adı: Platformun ticari adı için ekibimizle görüşün.*

---

### İş Etkisi

**Operasyonel görünürlük**
Yönetim sprint durumunu, kalite metriklerini ve teslimat geçmişini tek ekrandan anlık olarak okuyabilir.

**Maliyet konsolidasyonu**
Ortalama üç araçlı zincire kıyasla tek platform lisansı ve sıfır entegrasyon bakım maliyeti.

**Denetim ve uyum güvencesi**
Her gereksinim, test ve teslimat otomatik olarak kayıt altında. Denetim hazırlığı için ayrı el emeği gerekmez.

**Süreç standartlaşması**
Farklı ekipler ve projeler aynı platform üzerinde, organizasyonel standartlara uygun ancak kendi ihtiyaçlarına göre yapılandırılmış süreçlerde çalışır.

---

### Finansal Çerçeve

*Aşağıdaki rakamlar 30-50 kişilik bir yazılım ekibine ilişkin temsili hesaptır.*

| Kalem | Mevcut araç zinciri | Platform ile |
| --- | --- | --- |
| Backlog + iş takibi lisansı | Yıllık ~$6.000 | Dahil |
| Test yönetimi lisansı | Yıllık ~$5.000 | Dahil |
| Entegrasyon araçları / bakım | Yıllık ~$3.000–6.000 | Yok |
| Sprint/denetim hazırlık zamanı | ~80 saat/yıl (~$4.000) | ~10 saat/yıl |
| **Toplam tahmini maliyet** | **$18.000–21.000/yıl** | **Karşılaştırma için görüşelim** |

---

### Karar Çerçevesi

Değerlendirme için yanıtlanması gereken üç soru:

1. Şu anda yazılım teslimat sürecinde kaç araç kullanıyorsunuz ve bu araçların toplam yıllık maliyeti nedir?
2. "Bu özellik ne durumda, kalite durumu nedir?" sorusuna cevap vermek kaç dakika alıyor?
3. Denetim, ISO veya compliance gereksinimleri bu yıl gündemde mi?

Bu üç soruya verilecek cevaplar, platformun organizasyonunuza değer üretip üretmeyeceğini 15 dakikada netleştirir.

---

### Sonraki Adım

**30 dakikalık yönetici değerlendirme görüşmesi.**

Özellik demosu değil. Kullanım senaryonuzu, mevcut araç maliyetinizi ve organizasyonel uyumu birlikte değerlendiriyoruz.

Karar vermek zorunda değilsiniz — sadece bilgiye dayalı bir değerlendirme yapabilmek için yeterli görünürlüğü sağlıyoruz.

---

*Yazılım geliştirme süreçlerinizi tek omurgada yönetin.*

---

## Üst Yönetici Sorularına Hazır Cevaplar

### "Ekibimiz Jira kullanıyor. Neden değişelim?"
Jira iş takibinde güçlüdür. Ancak kalite yönetimi için büyük ihtimalle ayrı bir araç (Zephyr, TestRail) kullanıyorsunuzdur. Bu iki araç arasındaki entegrasyon bakımı, çift lisans ve veri kopukluğu süregelen bir maliyet. Platformumuz bu iki katmanı birleştiriyor. Değişim zorunlu değil — mevcut toplam maliyetle karşılaştırmanızı öneririz.

### "Bize özel bir şey var mı yoksa standart bir araç mı?"
Temel fark "manifest tabanlı" süreç modelidir. Organizasyonunuzun iş akışlarını, alan adlarını ve erişim kurallarını platforma uyarlamanıza izin verir. Araç sürece uyar, siz araca değil.

### "Güvenlik ve veri yönetişimi?"
Çok kiracılı mimari ile her organizasyonun verisi tam olarak izole edilir. Rol bazlı erişim kontrolü, denetim geçmişi ve süreç bazlı erişim kısıtlaması standarttır.

### "Geçiş ne kadar sürer ve maliyeti nedir?"
Bu sorunun cevabı mevcut araç zincirine ve ekip büyüklüğüne göre değişir. Görüşme sırasında geçiş planını birlikte çerçeveleyebiliriz.

### "Bu yatırımın geri dönüş süresi nedir?"
Araç konsolidasyonu ve verimlilik kazanımı hesaplanabilir. 30-50 kişilik ekiplerde 12-18 ay içinde amortisman genellikle görülüyor. Kendi rakamlarınızla hesap yapalım.

---

## Sunum Notu: Ürün Adı Konumlandırması

Bu belge bilinçli olarak ürünü adıyla değil, çözdüğü problemle tanıtacak şekilde yazıldı.

**Neden:** "ALM" hem yazılım hem de donanım/gömülü sistemler sektöründe kullanılan jenerik bir kategori adıdır. CEO veya Genel Müdür düzeyinde ilk temaslarda ürün adından önce çözülen problemi netleştirmek, yanlış referans noktası riskini ortadan kaldırır ve kararı kolaylaştırır.

**Doğru sıralama:**

1. Problem → 2. Çözüm → 3. İş değeri → 4. Ürün adı

Ürün adını tanıtım sıralamasının sonuna bırakın; o noktada dinleyicinin zihninde bağlam zaten kurulmuş olur.

---

## İlgili Dokümanlar (İç Kullanım)

- [EXECUTIVE_EMAIL_TR.md](./EXECUTIVE_EMAIL_TR.md) — Üst yöneticiye erişim e-postaları ve toplantı akışı
- [ONE_PAGER_TR.md](./ONE_PAGER_TR.md) — Orta düzey yönetici ve IT lider için ürün özeti
- [ROI_VALUE_ARGUMENTS_TR.md](./ROI_VALUE_ARGUMENTS_TR.md) — Detaylı ROI hesaplama çerçevesi
- [SALES_PITCH_DECK_TR.md](./SALES_PITCH_DECK_TR.md) — Sunum yapısı
- [COMPETITIVE_POSITIONING_TR.md](./COMPETITIVE_POSITIONING_TR.md) — Rakip karşılaştırma

↑ [Dokümanlar](README.md)
