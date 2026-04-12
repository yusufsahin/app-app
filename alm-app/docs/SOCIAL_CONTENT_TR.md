# ALM — LinkedIn & Sosyal Medya İçerik Paketi

Bu doküman LinkedIn organik içerik, kısa format paylaşımları ve ürün lansmanı için hazırlanmış sosyal medya metinlerini içerir.

---

## Kullanım Notları

- Her post bağımsız olarak yayınlanabilir
- Haftada 1-2 post için sıralı yayın planı önerilir
- Görseller için FIGMA_DESIGN_BRIEF.md'deki ekran görüntüsü önerileri kullanılabilir
- `#` etiketleri önerilen; platforma göre ayarlanabilir

---

## POST 1 — Problem Vurgusu (Hook formatı)

**Format:** LinkedIn uzun post
**Amaç:** Hedef kitlede tanıma yaratmak

---

Yazılım ekiplerinin büyük çoğunluğu backlog, test yönetimi ve deployment bilgisini 3 farklı araçta yürütüyor.

Bu parçalı yapı günde ne kadar zaman harcatıyor?

Tahminim: toplantıların %20-30'u bu araçlar arasında veri toplamak ve senkronize etmekle geçiyor.

Üç somut örnek:

1. PM sprint review hazırlığı için Jira'dan export alıyor, TestRail'den test özeti çekiyor, CI/CD panosundan deployment bilgisi toplayıp Excel'de birleştiriyor.

2. QA lead bir defect'in hangi user story'ye bağlı olduğunu bulmak için iki sistem arası geçiş yapıyor.

3. Engineering manager "bu özellik hangi ortama çıktı?" sorusuna cevap vermek için Slack arşivini karıştırıyor.

Bu senaryolar tanıdık geliyorsa, araç parçalanması sizi düşündüğünüzden daha fazla maliyete sokuyordur.

Biz bunu tek platformda çözüyoruz: ALM.

Backlog, kalite operasyonu ve teslimat izlenebilirliği. Tek veri modeli, tek bağlam.

[Demo talebine link]

#ALM #AgilePM #SoftwareQuality #ProjectManagement #DevOps

---

## POST 2 — Manifest Özelliği Vurgusu (Eğitici format)

**Format:** LinkedIn carousel veya liste post
**Amaç:** Teknik farklılaştırıcıyı açıklamak

---

Çoğu ALM aracı şunu söyler: "Agile, Scrum ya da CMMI şablonlarından birini seç."

ALM farklı bir şey söylüyor: "Kendi sürecini tanımla."

**Manifest tabanlı süreç modeli ne anlama geliyor?**

Proje bazında YAML/JSON ile şunları tanımlarsınız:

→ Artifact tipleri
(Epic, Story, Feature, Requirement, Defect... ya da ne istiyorsanız)

→ Workflow state'leri ve geçiş kuralları
(Draft → Review → Approved → In Progress → Done; guard'larla kontrollü geçişler)

→ Özel alanlar
(Her artifact tipine özgü metadata)

→ Link tipleri
(covers, depends-on, blocks, relates-to... proje ihtiyacına göre)

→ Erişim kuralları
(Kim neyi görebilir, neyi yapabilir)

Kod değişikliği olmadan.

Ekibin süreci araca değil, aracın sürece uyduğu model bu.

Özellikle farklı metodoloji kullanan birden fazla ekibin aynı platformda çalışması gerektiğinde bu esneklik kritik.

#ALM #ProcessManagement #SoftwareDevelopment #AgileTransformation

---

## POST 3 — Kalite + Backlog Birleşimi (Senaryo formatı)

**Format:** LinkedIn hikaye post
**Amaç:** QA persona'sına ulaşmak

---

Bir QA lead'in gününü düşünün.

Sabah: TestRail'de test case'leri düzenliyor.
Öğlen: Jira'da bu test case'lere karşılık gelen user story'leri bulup bağlantıyı aklında tutuyor.
Akşam: Test run sırasında bulunan bir defect'i Jira'ya açıyor, TestRail'de de işaretliyor.

İki sistem. İki bağlam. Sürekli geçiş.

ALM'de bu akış şöyle çalışıyor:

✓ Test case kataloğu backlog ile aynı platformda
✓ Her test case doğrudan artifact'e bağlanıyor
✓ Manual test run sırasında başarısız adımdan tek tıkla defect oluşturuluyor
✓ O defect anında backlog'da görünüyor
✓ Requirement traceability matrix ayrıca export gerektirmiyor

QA ekibinin zamanını iki sistem arası geçişe harcamaması için bu fark yeterli.

#QAManagement #SoftwareTesting #TestManagement #AgileQA

---

## POST 4 — Traceability Vurgusu (Soru formatı)

**Format:** LinkedIn kısa post + anket
**Amaç:** Engagement ve hedef kitle tespiti

---

Sormak istiyorum:

Ekibinizde "bu gereksinim hangi testlerle doğrulandı, hangi deployment ile çıktı?" sorusuna cevap vermek ne kadar sürüyor?

A) 5 dakikadan az, tek sistemden
B) 15-30 dakika, 2-3 araç arası geçiş
C) Birkaç saat, birden fazla kişiden bilgi toplamak
D) Bu bilgiyi net olarak bilmiyoruz

Bu soru denetim görüşmelerinde, kalite kapılarında ve post-incident analizlerde çok sık karşımıza çıkıyor.

A şıkkı cevabı olanlar nadir. Ve genellikle ciddi araç yatırımı yapmış ekipler.

ALM bu soruyu artifact bağlamından cevaplıyor. Gereksinimden test case'e, defect'ten commit'e, deployment'a kadar tek izlenebilirlik zinciri.

Hangi şıkta olduğunuzu yorumda belirtin. İlginç sonuçlar çıkacak.

#Traceability #SoftwareQuality #RegulatoryCompliance #ALM

---

## POST 5 — Ürün Lansmanı / Duyuru Postu

**Format:** LinkedIn duyuru postu
**Amaç:** Farkındalık ve demo trafik yaratma

---

ALM'i duyuruyoruz.

Backlog, kalite yönetimi ve teslimat izlenebilirliğini tek platformda birleştiren manifest tabanlı bir Application Lifecycle Management çözümü.

Neden yaptık?

Çünkü çoğu yazılım ekibinin yaşam döngüsü verisi hâlâ parçalı. Backlog bir araçta, test yönetimi başka bir araçta, deployment bilgisi üçüncü bir yerde.

Bu dağınıklık görünürlük kaybına, süreç kaymasına ve araçlar arası entegrasyon yüküne dönüşüyor.

ALM bu üç katmanı tek veri modeli üzerinde birleştiriyor.

Öne çıkan özellikler:

→ Manifest tabanlı süreç motoru (proje bazında artifact, workflow, alan, link özelleştirmesi)
→ Backlog, kanban board ve release/cycle planning
→ Test case katalogları, suite, campaign, manual run, defect akışı
→ GitHub ve GitLab webhook entegrasyonu
→ Deployment event traceability
→ RBAC, audit history, multi-tenant mimari

İlk demo randevuları için bağlantı profilde.

#ProductLaunch #ALM #SoftwareEngineering #ProjectManagement #QualityAssurance

---

## POST 6 — Rakip Karşılaştırma (Diplomatik format)

**Format:** LinkedIn eğitici post
**Amaç:** Konumlandırma netleştirme

---

"Jira + TestRail" kombinasyonu neden yaygın?

Çünkü her iki araç da kendi alanında iyi.

Jira backlog ve iş takibinde güçlü. TestRail test yönetiminde olgun. Bu kombinasyona yıllarca yatırım yapmış ekipler var.

Ama bu kombinasyonun getirdiği üç yük var:

1. İki lisans, iki kullanıcı yönetimi
2. Entegrasyon bakımı (ve bazen kırılan entegrasyonlar)
3. "Bu story'nin test durumu nerede?" sorusuna cevap vermek için sistem değiştirmek

ALM bu iki dünyayı tek platformda birleştiriyor.

Jira + TestRail kullanıyorsanız ALM'in size sunduğu şey şu: ayrı araç maliyeti olmadan aynı kapsam.

Farkı görmek istiyorsanız 30 dakikalık bir demo yeterli.

[Demo linki]

#ALM #TestManagement #BacklogManagement #SoftwareTools

---

## POST 7 — Müşteri Senaryosu (Case Study formatı)

**Format:** LinkedIn hikaye post
**Amaç:** Sosyal kanıt oluşturmak

---

*[Bu şablon, gerçek müşteri deneyimleri elde edildikçe somut verilerle doldurulabilir]*

---

[Şirket] ekibi ALM'e geçmeden önce şu tablodaydı:

Backlog: Jira
Test yönetimi: TestRail
Deployment takibi: Confluence sayfaları + Slack
Traceability: Excel export

Her sprint sonunda bu dört kaynaktan veri toplamak 2-3 saat alıyordu.

Geçişten 3 ay sonra:

✓ Sprint review hazırlığı tek platformdan
✓ QA akışı backlog ile aynı bağlamda
✓ Deployment ve SCM görünürlüğü artifact bazlı
✓ Audit hazırlığı için ek çalışma yok

Araç sayısı 4'ten 1'e indi.

Benzer bir yapınız varsa konuşmaya değer.

[Demo linki]

#CustomerSuccess #ALM #SoftwareTeams #ProductivityTools

---

## POST 8 — Kısa Format / Twitter / X

**Format:** Kısa post (280 karakter)
**Amaç:** Hızlı farkındalık ve paylaşım

---

**Varyant A:**
Backlog ayrı araçta. Test yönetimi ayrı araçta. Deploy bilgisi Slack'te.

Bu araç sayısı kaçta?

ALM: tek platform, tek bağlam.

#ALM #SoftwareEngineering

---

**Varyant B:**
Kalite yönetimi eklenti değil, çekirdek özellik olmalı.

Test case katalogları, suite/campaign, manual run ve defect akışı ALM'de backlog ile aynı veri modeli üzerinde çalışıyor.

#QA #TestManagement #ALM

---

**Varyant C:**
Sürecini araca mı uyduruyorsun?

Manifest tabanlı ALM ile artifact tipler, workflow state'ler, özel alanlar ve link tipleri proje bazında tanımlanıyor.

Araç sürece uymak zorunda. Sen değil.

#ALM #AgileTransformation

---

## Yayın Planı Önerisi

| Hafta | Post | Format |
|---|---|---|
| 1 | Post 1 (Problem) | Uzun LinkedIn |
| 1 | Post 8A (Kısa) | X/Twitter |
| 2 | Post 2 (Manifest) | LinkedIn liste |
| 2 | Post 4 (Anket) | LinkedIn anket |
| 3 | Post 3 (QA) | LinkedIn hikaye |
| 3 | Post 8B (Kısa) | X/Twitter |
| 4 | Post 6 (Rakip) | LinkedIn eğitici |
| 5 | Post 5 (Lansman) | LinkedIn duyuru |
| 6 | Post 7 (Case Study) | LinkedIn hikaye |
| 6 | Post 8C (Kısa) | X/Twitter |

---

## Görsel Öneriler

Her post için önerilen ekran görüntüsü veya grafik:

- Post 1: Dashboard + araç parçalanması infografik
- Post 2: Manifest editörü ekran görüntüsü (YAML/JSON)
- Post 3: Manual execution player ekranı
- Post 4: Traceability matrix ekranı
- Post 5: Platform genel görünüm (multi-panel)
- Post 6: Karşılaştırma tablosu grafiği
- Post 7: Sayısal sonuçlar (before/after)

---

## İlgili Dokümanlar

- [MARKETING_MESSAGE_FRAMEWORK_TR.md](./MARKETING_MESSAGE_FRAMEWORK_TR.md)
- [COMPETITIVE_POSITIONING_TR.md](./COMPETITIVE_POSITIONING_TR.md)
- [LANDING_PAGE_COPY_TR.md](./LANDING_PAGE_COPY_TR.md)

↑ [Dokümanlar](README.md)
