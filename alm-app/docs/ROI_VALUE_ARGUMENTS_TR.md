# ALM — ROI ve İş Değeri Argümanları

Bu doküman satış görüşmelerinde, teklif aşamasında ve yönetim sunum hazırlığında kullanılacak ROI çerçevesini ve iş değeri argümanlarını içerir.

---

## 1. ROI Çerçevesi

ALM'in iş değeri üç başlık altında çerçevelenir:

1. **Maliyet düşürme** — araç parçalanmasından kaynaklanan direkt ve dolaylı maliyetler
2. **Verimlilik artışı** — araçlar arası geçiş ve manuel senkronizasyona harcanan zaman
3. **Risk azaltma** — görünürlük eksikliğinden kaynaklanan süreç kaybı ve denetim riski

---

## 2. Araç Parçalanması Maliyet Analizi

### Mevcut yaygın araç zinciri maliyeti

Orta ölçekli bir yazılım ekibinde (30 geliştirici + 10 QA) tipik araç zinciri:

| Araç | Amaç | Yıllık Maliyet (tahmin) |
|---|---|---|
| Jira Software | Backlog, board, sprint | ~$12/kullanıcı/ay → 40 kişi → ~$5.800/yıl |
| TestRail | Test yönetimi | ~$38/kullanıcı/ay → 10 QA → ~$4.560/yıl |
| Confluence | Dokümantasyon | ~$5/kullanıcı/ay → 40 kişi → ~$2.400/yıl |
| Entegrasyon aracı | Araçlar arası köprü | ~$2.000-5.000/yıl (Zapier, özel dev) |
| **Toplam** | | **~$14.760–17.760/yıl** |

*Not: Bu rakamlar 2024 güncel lisans fiyatlarına dayanır. Ekip boyutu ve kullanılan plan tier'ına göre değişir.*

### ALM yaklaşımındaki tasarruf potansiyeli

- TestRail lisansı ortadan kalkar
- Entegrasyon bakım maliyeti azalır
- Birden fazla admin/kullanıcı yönetimi konsolide olur

**Temel argüman:** "Sadece TestRail + entegrasyon maliyetini hesapladığınızda, çoğu ekipte ALM birleşik maliyette eşdeğer veya avantajlı çıkıyor."

---

## 3. Zaman ve Verimlilik Argümanları

### Araçlar arası geçiş maliyeti

Araştırmalar (Asana iş durumu raporu, McKinsey) şunu gösteriyor:
- Bilgi çalışanları zamanlarının ~%28'ini email ve araçlar arası iletişime harcıyor
- Bağlam anahtarlama (context switching) günlük ~23 dakika verimsizliğe yol açıyor

**ALM bağlamında somut örnekler:**

**Sprint review hazırlığı**
- Mevcut durum: Jira export + TestRail özeti + CI/CD panosu → Excel → sunum: ~3 saat/sprint
- ALM ile: Dashboard + planning ekranı zaten birleşik: ~30 dakika/sprint
- **Tasarruf: ~2,5 saat/sprint** (yılda 24 sprint için ~60 saat/kişi)

**Defect traceability**
- Mevcut durum: Defect'in hangi story'e bağlı olduğunu bulmak: 2 sistem, ~15 dakika
- ALM ile: Artifact bağlamında, anında görünür: ~1 dakika
- **Tasarruf: ~14 dakika/defect sorgusu**

**Deployment audit hazırlığı**
- Mevcut durum: Hangi özellik hangi deployment'ta çıktı: 4 kaynak → ~2-4 saat
- ALM ile: Artifact bazlı deployment event log: ~10 dakika
- **Tasarruf: ~2-3 saat/audit sorgusu**

### Zaman tasarrufu hesabı

| Senaryo | Mevcut | ALM ile | Tasarruf |
|---|---|---|---|
| Sprint review hazırlığı (24 sprint/yıl) | 72 saat/yıl | 12 saat/yıl | 60 saat/yıl |
| Defect traceability (ortalama 5/gün) | ~1,2 saat/gün | ~5 dakika/gün | ~1 saat/gün |
| Audit hazırlığı (4/yıl) | 8-16 saat/yıl | 40 dakika/yıl | ~12 saat/yıl |

30 kişilik ekipte ortalama saat başı maliyet $50 varsayıldığında, yıllık tasarruf potansiyeli:
- Sprint review: 60 saat × $50 = **$3.000/yıl**
- Günlük defect traceability: ~250 iş günü × 1 saat × $50 = **$12.500/yıl**
- Audit: 12 saat × $50 = **$600/yıl**
- **Toplam: ~$16.100/yıl verimlilik değeri**

---

## 4. Risk Azaltma Argümanları

### Görünürlük kaybından kaynaklanan riskler

**1. Geç tespit maliyeti**
IBM araştırmasına göre bir yazılım hatasını prodüksiyon sonrası düzeltmek, geliştirme aşamasında düzeltmekten 10-15x daha maliyetli.

ALM'in kalite entegrasyonu bu geç tespit riskini azaltır:
- Backlog ile kalite aynı bağlamda → test kapsamı backlog kararlarına erken yansır
- Defect akışı anlık → tespit → çözüm döngüsü kısalır

**2. Denetim hazırlık riski**
Denetim veya compliance gereksinimleri olan sektörlerde (finans, sağlık, kamu, ISO/CMMI uyumu):
- Traceability kaydı el emeği ile tutuluyorsa hata riski yüksek
- ALM'in yerleşik audit history ve artifact bazlı traceability bu riski azaltır

**3. Ekip değişikliği riski**
Bilgi birden fazla araçta dağınık tutulduğunda, ekip değişikliklerinde bilgi kaybı riski artar.
- ALM'in tek platform modeli kurumsal bilgiyi konsolide eder

**4. Entegrasyon kırılma riski**
Birden fazla araç zincirinde entegrasyon noktaları güncelleme veya API değişikliklerinde kırılabilir.
- ALM'in yerleşik entegrasyonu bu bakım yükünü ortadan kaldırır

---

## 5. Değer Argümanları — Persona Bazında

### Ürün Sahibi / PM için

**Temel kazanım:** Sprint görünürlüğü ve karar kalitesi

- Velocity ve burndown tek ekranda
- Kalite durumu sprint kararlarına entegre (test kapsamı görünür)
- Artifact bazlı teslimat izi ile "bu sprint ne çıktı?" sorusu net cevaplanabilir

**ROI argümanı:** "Sprint planlamasında daha az zaman harcayıp daha bilgili kararlar almak."

### QA Lead için

**Temel kazanım:** Araç yükü ve context switching azalması

- Test case, suite, campaign, run tek platform
- Defect'ten artifact'e bağlantı anlık
- Test coverage backlog bağlamında görünür
- Raporlama için export veya araç geçişi gerekmez

**ROI argümanı:** "QA ekibi araçlarla değil, kalite ile ilgileniyor."

### Engineering Manager için

**Temel kazanım:** Teslimat görünürlüğü ve audit kolaylığı

- SCM ve deployment bağlantıları artifact bağlamında
- Audit history, RBAC tek yapıda
- Traceability raporları anlık

**ROI argümanı:** "Delivery durumunu toplamak için değil, analiz etmek için zaman harcamak."

### CFO / Yönetim için

**Temel kazanım:** Toplam sahip olma maliyeti (TCO) ve süreç riski

- Araç konsolidasyonu = lisans + entegrasyon tasarrufu
- Denetim ve compliance hazırlık maliyeti azalır
- Bilgi kaybı ve süreç kırılması riski düşer

**ROI argümanı:** "3 araç yerine 1 araç: lisans, bakım ve entegrasyon maliyeti tek kalemde."

---

## 6. Değer Hesaplama Şablonu

Müşteriye özel ROI hesabı için kullanılabilecek sorular:

```
1. Kaç geliştirici, QA ve PM kullanıcısı var?
2. Şu an hangi araçları kullanıyorsunuz ve aylık/yıllık maliyetleri ne?
3. Sprint review, audit hazırlığı için haftalık/aylık kaç saat harcıyorsunuz?
4. QA ve geliştirme araçları arasında entegrasyon bakımı için yıllık ne harcıyorsunuz?
5. Denetim veya compliance gereksinimleri var mı?
```

Bu sorulara verilecek cevaplarla basit bir ROI hesabı yapılabilir:

```
Mevcut toplam araç maliyeti: [X]
Araçlar arası geçiş zamanı (saat/yıl × saat başı maliyet): [Y]
Entegrasyon bakım maliyeti: [Z]
------
Toplam mevcut maliyet: X + Y + Z

ALM maliyeti: [ALM lisans fiyatı]

Yıllık tasarruf = (X + Y + Z) - ALM maliyeti
```

---

## 7. İtiraz Yönetimi — Maliyet Odaklı

### "ALM pahalı"
> "Anlıyorum. Şu anda kullandığınız araçların toplam maliyetini birlikte hesaplayalım. Jira, TestRail ve entegrasyon bakımını topladığınızda ALM genellikle eşdeğer veya avantajlı çıkıyor. Buna ek olarak, araçlar arası geçiş için harcanan zamanın maliyetini de hesaba katmak gerekiyor."

### "Bütçemiz yok"
> "Bu dönemde anlamlı bir kısıt. İki şeyi sormak isterim: Birincisi, mevcut araçlarınızın toplam yıllık maliyeti ne? İkincisi, QA ve backlog araçları arasında senkronizasyon için harcanan zamanın maliyeti nedir? Çoğu zaman konsolidasyon bütçeyi tüketmiyor, yeniden dağıtıyor."

### "Geçiş maliyeti yüksek"
> "Geçiş gerçek bir maliyet. Ama bunu tek seferlik bir maliyet olarak bir de araç çoğalmasının yıllık süregelen maliyetiyle karşılaştırmak lazım. Genellikle 12-18 ay içinde geçiş maliyeti amorti oluyor. Pilot proje yaklaşımıyla başlamayı değerlendirebiliriz."

---

## 8. Referans Metrikler (Sektör Kaynakları)

Satış görüşmelerinde kullanılabilecek bağımsız araştırma referansları:

- **Araç parçalanması:** Gartner, 2023 — Ortalama yazılım ekibi 4-8 farklı geliştirme/yönetim aracı kullanıyor
- **Context switching:** RescueTime araştırması — Bağlam anahtarlama sonrası odak yeniden sağlamak ~23 dakika alıyor
- **Geç tespit maliyeti:** IBM System Sciences Institute — Üretimde bulunan hata, tasarım aşamasındakinden 15x daha maliyetli
- **Verimlilik kaybı:** Asana Anatomy of Work Report — Bilgi çalışanları zamanlarının %26'sını koordinasyona harcıyor

---

## 9. İlgili Dokümanlar

- [MARKETING_MESSAGE_FRAMEWORK_TR.md](./MARKETING_MESSAGE_FRAMEWORK_TR.md)
- [COMPETITIVE_POSITIONING_TR.md](./COMPETITIVE_POSITIONING_TR.md)
- [ONE_PAGER_TR.md](./ONE_PAGER_TR.md)
- [SALES_PITCH_DECK_TR.md](./SALES_PITCH_DECK_TR.md)

↑ [Dokümanlar](README.md)
