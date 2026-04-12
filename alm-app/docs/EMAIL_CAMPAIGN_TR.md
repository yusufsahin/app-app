# ALM — E-posta Nurture Kampanyası

Bu doküman soğuk erişim (cold outreach) ve demo talep sonrası nurture için hazırlanmış 5 e-posta içerir. Her e-posta farklı bir değer açısını vurgular.

---

## Kullanım Notları

- E-postalar sırayla gönderilebilir (Day 1 → Day 4 → Day 7 → Day 12 → Day 18)
- Her e-posta bağımsız olarak da kullanılabilir
- `[İsim]`, `[Şirket]`, `[Sektör]` alanlarını kişiselleştirin
- Konu satırları A/B test için iki alternatifle sunulmuştur

---

## E-posta 1 — Açılış / Problem Tanımlama

**Gönderim:** Day 1 (ilk temas)

**Konu A:** Backlog, kalite ve deploy bilgisi kaç farklı araçta?
**Konu B:** Yazılım yaşam döngünüzde araç sayısı kaç?

---

Merhaba [İsim],

[Şirket] gibi yazılım ekiplerinde sık karşılaştığımız bir durumu sormak istedim:

Backlog başka bir araçta, test yönetimi başka bir araçta, deployment bilgisi ise ya CI/CD panosunda ya da Slack mesajlarında kalıyor.

Bu parçalı yapı üç şeyi zorlaştırıyor:

- Bir gereksinimin hangi testlerle doğrulandığını tek yerden görmek
- Bir defect'in hangi commit ve deployment ile ilişkili olduğunu izlemek
- Sprint ve kalite görünürlüğünü yönetim katmanına aynı anda sunmak

ALM bu üç katmanı — backlog, kalite yönetimi ve teslimat izlenebilirliği — tek platformda birleştiriyor. Fazladan eklenti veya araç köprüsü olmadan.

Ekibinizin bugünkü araç düzenini 15 dakikada birlikte değerlendirmek ister misiniz?

[CTA Butonu: Demo Planlayalım]

Saygılarımla,
[Gönderen Adı]
ALM

---

## E-posta 2 — Farklılaştırıcı / Manifest Vurgusu

**Gönderim:** Day 4

**Konu A:** Süreçlerinizi araca mı uyduruyor musunuz?
**Konu B:** Workflow'larınız hazır şablona sığıyor mu?

---

Merhaba [İsim],

Yazılım ekiplerinin büyük çoğunluğu süreçlerini araçlarına uydurmak zorunda kalıyor.

Jira'da sabit workflow şablonları seçiyorsunuz. Azure DevOps'ta üç hazır süreç modeli var: Agile, Scrum ya da CMMI. Bunların dışına çıkmak yapılandırma karmaşasına dönüşüyor.

ALM bu kısıtlamayı farklı bir yerden çözüyor.

Manifest tabanlı yapı sayesinde proje bazında şunları tanımlayabiliyorsunuz:

- Artifact tipleri (Epic, Story, Defect, Feature, Requirement... ya da ne istiyorsanız)
- Workflow state'leri ve geçiş kuralları
- Özel alanlar
- Link tipleri (covers, depends on, blocks, related...)
- Erişim kuralları

Kod değişikliği olmadan. Tek bir YAML/JSON dokümanıyla.

Her proje farklı çalışır. ALM bunu kabul eden birkaç araçtan biri.

Demo sırasında manifest editörünü 5 dakika içinde birlikte inceleyebiliriz.

[CTA Butonu: Görüşme Ayarlayalım]

[Gönderen Adı]

---

## E-posta 3 — Kalite Yönetimi Vurgusu

**Gönderim:** Day 7

**Konu A:** Test yönetiminiz backlog'unuzdan kopuk mu?
**Konu B:** QA ekibiniz başka bir araçta mı çalışıyor?

---

Merhaba [İsim],

QA ekiplerinin büyük bölümü iş takibinden ayrı bir araçta çalışıyor.

TestRail ya da benzeri bir araçta test case'ler yönetiliyor. Backlog başka bir yerde. İki sistem arasında bağ kurmak için entegrasyon ya da manuel köprü gerekiyor.

Sonuç: QA durumu karar süreçlerine geç yansıyor. Bir story'nin test durumunu görmek için sistemi değiştirmek gerekiyor. Defect'ler backlog bağlamından kopuk kalıyor.

ALM'de kalite yönetimi ayrı bir modül değil. Çekirdek kullanım senaryosunun bir parçası.

Şunların hepsi aynı platformda:

- Test case kataloğu (organize, hiyerarşik)
- Test suite ve campaign yönetimi
- Manual test run yürütme (adım bazlı)
- Başarısız adımdan tek tıkla defect oluşturma
- Run içinden artifact'e bağlantı

Bir QA lead'in test execution yaptığı sahneden, defect'in backlog'da göründüğü ana kadar geçen süreyi birlikte görmek ister misiniz?

[CTA Butonu: Kalite Akışını Göster]

[Gönderen Adı]

---

## E-posta 4 — Traceability & Denetim Vurgusu

**Gönderim:** Day 12

**Konu A:** Hangi deployment hangi gereksinimi içeriyor? Yanıtı tek yerden verebiliyor musunuz?
**Konu B:** Gereksinimden deploy'a izlenebilirlik: kurumunuzda bu ne kadar görünür?

---

Merhaba [İsim],

Denetim veya kalite kapısı süreçleriniz varsa muhtemelen bu soruyu düzenli karşılıyorsunuzdur:

"Bu gereksinim hangi testlerle doğrulandı ve hangi ortama kadar gitti?"

Bu soruyu cevaplamak için kaç araç açıyorsunuz? Kaç kişiden bilgi alıyorsunuz?

ALM'de bu zincir artifact bağlamında görünür:

- Requirement → test case bağlantısı
- Test run sonuçları → defect → backlog
- SCM linkleri → commit ve PR bağlantıları (GitHub, GitLab webhook)
- Deployment event kaydı → hangi ortama, ne zaman, hangi artifact ile ilişkili

Tek bağlamda. Toplantı veya export olmadan.

Bu görünürlük özellikle şu senaryolarda değerli:

- Düzenleyici gereksinimleri olan sektörler (finans, sağlık, kamu)
- Süreç olgunluğu veya ISO/CMMI uyum çalışmaları
- İç denetim ve kalite kapısı süreçleri
- Çok takımlı, çok projeli teslimat yönetimi

[Şirket]'te bu katmanın nasıl çalıştığını birlikte değerlendirmek ister misiniz?

[CTA Butonu: Traceability Demosu İsteyin]

[Gönderen Adı]

---

## E-posta 5 — Kapanış / Son Temas

**Gönderim:** Day 18

**Konu A:** Son mesaj — ALM hakkında bir sorum var
**Konu B:** Hâlâ doğru zaman değil mi? Anlıyorum.

---

Merhaba [İsim],

Son olarak ulaşıyorum.

Eğer ALM'i inceleme zamanı gelmedi veya şu an öncelikli değilse tamamen anlıyorum. Listemizden çıkmak isterseniz bana bildirmeniz yeterli.

Ancak bir şeyi sormak istedim: Backlog, kalite ve teslimat görünürlüğü için şu anda kaç araç kullanıyorsunuz?

Bu sayı üç veya daha fazlaysa — ve bu araçlar arasında bağ kurmak için el emeği ya da entegrasyon bakımı harcıyorsanız — ALM'in birleşik modelini en az bir kez incelemeye değer.

30 dakikalık bir demo, ekibinizin mevcut araç düzeniyle nasıl uyuştuğunu net görmenizi sağlar.

Uygun bir zaman seçebilirsiniz:

[CTA Butonu: Takvim Linki]

Yanıt vermemeniz durumunda başka bir e-posta göndermeyeceğim. Gelecekte ihtiyaç duyarsanız her zaman ulaşabilirsiniz.

Başarılar dilerim,
[Gönderen Adı]
ALM

---

## Ek — Demo Talep Sonrası Onay E-postası

**Tetikleyici:** Demo formu dolduruldu

**Konu:** Demo talebiniz alındı — [Tarih] için hazırlık notları

---

Merhaba [İsim],

Demo talebinizi aldık. [Tarih / Saat] için takvim davetini ayrıca gönderiyoruz.

Demo öncesinde şunları düşünmeniz görüşmeyi daha verimli kılacaktır:

1. Bugün backlog, test yönetimi ve teslimat takibi için hangi araçları kullanıyorsunuz?
2. Ekibinizde QA veya test yönetimi sorumluluğu olan kaç kişi var?
3. Traceability veya denetim gereksinimleri var mı?

Özellikle odaklanmamızı istediğiniz bir alan varsa (planning, kalite, traceability, manifest özelleştirme) önceden belirtebilirsiniz.

Görüşmede görüşmek üzere.

[Gönderen Adı]

---

## E-posta Performans Metrikleri (Hedef)

| Metrik | Hedef |
|---|---|
| Açılma oranı (cold) | %25–35 |
| Tıklanma oranı | %3–8 |
| Demo dönüşüm (sequence) | %5–10 |
| Abonelikten çıkma | <%2 |

---

## İlgili Dokümanlar

- [MARKETING_MESSAGE_FRAMEWORK_TR.md](./MARKETING_MESSAGE_FRAMEWORK_TR.md)
- [LANDING_PAGE_COPY_TR.md](./LANDING_PAGE_COPY_TR.md)
- [COMPETITIVE_POSITIONING_TR.md](./COMPETITIVE_POSITIONING_TR.md)
- [DEMO_SCRIPT_TR.md](./DEMO_SCRIPT_TR.md)

↑ [Dokümanlar](README.md)
