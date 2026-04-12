# ALM — Rekabetçi Konumlandırma & Battle Cards

Bu doküman satış görüşmelerinde rakip araçlarla karşılaştırma yapıldığında kullanılacak bilgileri ve itiraz yönetimi rehberini içerir.

---

## 1. Pazar Konumlandırma Haritası

ALM aşağıdaki eksenlerde konumlanır:

```
                      Backlog + Kalite Birleşimi
                              ▲
                              │
          ALM ─────────────── │ ──────── TestRail + Jira (ayrı araç)
                              │
   Sabit Süreç ───────────────┼─────────────── Uyarlanabilir Süreç
                              │
          Azure DevOps ───────│──── Linear
                              │
                              ▼
                        Yalnızca Backlog
```

**ALM'in konumlandırma boşluğu:**
- Backlog + kalite birleşimi → çoğu rakip bu iki boyutu ayrı araçlara böler
- Uyarlanabilir süreç → Jira ve Azure DevOps sabit şablon mantığı; ALM manifest tabanlı özelleştirme sunar
- Traceability çekirdeği → gereksinimden deploy'a zincir çoğu araçta eklenti ile sağlanır

---

## 2. Jira vs ALM

### Jira'nın güçlü yanları
- Geniş eklenti ekosistemi (Atlassian Marketplace)
- Çok bilinen UX, büyük kullanıcı tabanı
- Atlassian ürünleriyle derin entegrasyon (Confluence, Bitbucket)

### Jira'nın sınırlı kaldığı noktalar
- Kalite yönetimi için ayrı araç gerekir (Zephyr, Xray eklentisi)
- Eklenti katmanı ekstra lisans ve bakım maliyeti yaratır
- Süreç özelleştirmesi yapılandırma karmaşıklığına dönüşebilir
- Traceability için eklenti zinciri kurulması gerekir
- Deployment ve SCM görünürlüğü Atlassian ekosistemi dışında sınırlı kalır

### ALM'in öne çıktığı alanlar

| Boyut | Jira + eklentiler | ALM |
|---|---|---|
| Kalite yönetimi | Zephyr/Xray eklentisi (ek lisans) | Çekirdek modül, ek lisans yok |
| Traceability | Eklenti + manuel köprü | Artifact bağlamında yerleşik |
| Süreç özelleştirme | Yapılandırma ekranları | Manifest DSL |
| Deployment görünürlüğü | Atlassian ekosistemine bağlı | Webhook tabanlı açık entegrasyon |
| Tenant/org ayrımı | Proje bazlı izolasyon | PostgreSQL RLS, tam tenant ayrımı |

### Satış itirazı: "Jira'ya alışkınız"
> "Alışkanlık mantıklı bir kriterdir. ALM'in farkı şu: Jira'da kalite yönetimini Zephyr veya Xray ile açmak ikinci bir lisans ve eklenti katmanı demek. Traceability için yine bir köprü kurmanız gerekiyor. ALM bu üç katmanı tek ürüne taşıdığı için bakım ve entegrasyon yükü azalıyor. Birlikte kendi kullanım senaryonuza göre bir karşılaştırma yapalım."

---

## 3. Azure DevOps vs ALM

### Azure DevOps'un güçlü yanları
- CI/CD, repo, artifact ve board tek platformda
- Microsoft ekosistemi ile derin entegrasyon
- Enterprise lisanslama ve SSO

### Azure DevOps'un sınırlı kaldığı noktalar
- Test Plans modülü ayrı lisans gerektirir
- Süreç şablonları (Agile, Scrum, CMMI) sabit; özelleştirme karmaşık
- Manifest tabanlı, proje bazlı süreç uyarlaması yok
- Kalite-backlog-deployment zinciri kurulum gerektiriyor
- Azure'a bağlı olmayan ortamlar için entegrasyon sınırlı

### ALM'in öne çıktığı alanlar

| Boyut | Azure DevOps | ALM |
|---|---|---|
| Süreç şablonu | Sabit 3 şablon | Manifest ile proje bazlı özelleştirme |
| Test yönetimi | Test Plans (ek lisans) | Çekirdek modül |
| Cloud bağımlılığı | Azure'a bağlı optimal deneyim | Cloud-agnostic, Docker-native |
| Deployment traceability | Azure Pipelines ile optimize | Açık webhook, herhangi CI/CD |
| Manifest tabanlı erişim | Yok | ACLEngine, manifest ACL |

### Satış itirazı: "Azure DevOps zaten her şeyi yapıyor"
> "Azure DevOps güçlü bir platform, özellikle Microsoft ekosistemine yatırım yapmış ekipler için. ALM'in konuştuğu nokta şu: süreç modelini proje bazında uyarlamak istiyorsanız, Azure DevOps'un sabit şablon mantığı bir noktadan sonra engel olabiliyor. Kalite yönetimini ayrıca lisanslamak zorunda kalmadan ve dışarıdaki CI/CD araçlarınızdan bağımsız traceability kurmak istiyorsanız ALM daha doğrudan bir model sunuyor."

---

## 4. Linear vs ALM

### Linear'ın güçlü yanları
- Hız odaklı, temiz UX
- Developer-first deneyimi
- Hızlı kurulum, düşük yönetim yükü

### Linear'ın sınırlı kaldığı noktalar
- Kalite yönetimi (test case, run, campaign) yok
- Traceability modeli yüzeysel
- Kurumsal yapı (RBAC, audit, tenant) sınırlı
- Süreç özelleştirmesi ileri düzey senaryolar için yetersiz
- QA odaklı ekipler için kapsam dışı

### ALM'in öne çıktığı alanlar

| Boyut | Linear | ALM |
|---|---|---|
| Test yönetimi | Yok | Tam modül |
| Traceability | Sınırlı | Gereksinimden deploy'a |
| RBAC & audit | Temel düzey | Manifest ACL + audit history |
| Organizasyonel yapı | Takım bazlı | Multi-tenant, org/proje hiyerarşisi |
| Hedef profil | Developer-first startup | Orta/büyük ölçekli, QA ağırlıklı ekip |

### Satış itirazı: "Linear çok daha basit ve hızlı"
> "Linear'ın hız odaklı yaklaşımı küçük geliştirici ekipler için ideal. ALM'in hitap ettiği profil biraz farklı: kalite operasyonu, test kampanyaları, defect akışı ve izlenebilirlik ihtiyacı olan ekipler için Linear yetersiz kalıyor. Eğer QA ve traceability ön planda değilse Linear harika bir tercih. Ama bu iki katman öncelikliyse ALM daha uygun bir yer."

---

## 5. TestRail + Jira Kombinasyonu vs ALM

### Mevcut yaygın kombinasyon
Birçok ekip TestRail (kalite) + Jira (backlog) kombinasyonunu kullanır.

### Bu kombinasyonun sınırlı kaldığı noktalar
- İki ayrı lisans, iki ayrı kullanıcı yönetimi
- Veri senkronizasyonu için entegrasyon bakımı gerekir
- Jira'daki story ile TestRail'deki test case arasında gerçek zamanlı bağ kurulamaz
- Deployment traceability için üçüncü bir araç gerekmektedir
- Audit geçmişi iki sistemde dağılır
- Birleşik dashboard ve görünürlük için üçüncü araç ya da export gerekir

### ALM'in öne çıktığı alanlar

| Boyut | TestRail + Jira | ALM |
|---|---|---|
| Araç sayısı | 2 (+ entegrasyon maliyeti) | 1 |
| Lisans | 2 ayrı | Tek platform |
| Traceability | Manuel köprü + entegrasyon | Artifact bağlamında yerleşik |
| Birleşik dashboard | Yok / export | Çekirdek özellik |
| Veri modeli tutarlılığı | Ayrı veri modelleri | Tek veri modeli |
| Deployment görünürlüğü | Üçüncü araç gerekir | Webhook entegrasyonu |

### Satış itirazı: "TestRail + Jira iyi çalışıyor"
> "İyi çalışması mantıklı; bu kombinasyon yaygın ve olgun. Ama iki araç demek iki lisans, iki entegrasyon noktası ve iki kullanıcı yönetimi demek. Bir gereksinimin test durumunu ve deployment izini tek bağlamda görmek istediğinizde bu kombinasyon parçalanmaya başlıyor. ALM bunu tek platform üzerinden çözüyor. Mevcut maliyetinizi hesaplayıp karşılaştıralım isterseniz."

---

## 6. Konumlandırma Özeti Tablosu

| Boyut | Jira | Azure DevOps | Linear | TestRail+Jira | **ALM** |
|---|---|---|---|---|---|
| Backlog | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kalite yönetimi | Eklenti | Ek lisans | ✗ | TestRail | ✓ Yerleşik |
| Manifest tabanlı süreç | ✗ | ✗ | ✗ | ✗ | ✓ |
| Deployment traceability | Sınırlı | Azure-bağlı | ✗ | ✗ | ✓ |
| SCM linkleri | Sınırlı | Azure-bağlı | Kısmi | ✗ | ✓ (GitHub/GitLab) |
| Tek platform | Kısmen | Evet | Evet | Hayır | ✓ |
| RBAC + audit | Sınırlı | Orta | Temel | Sınırlı | ✓ Kapsamlı |
| Multi-tenancy | Proje izolasyon | Org bazlı | Takım bazlı | Sınırlı | ✓ PostgreSQL RLS |
| Araç parçalanması | Yüksek | Orta | Düşük | Çok yüksek | Düşük |

---

## 7. İtiraz Yönetimi Hızlı Referans

### "Fiyat çok yüksek olabilir"
> "Tek platform maliyetini, TestRail + Jira kombinasyonundaki iki lisans + entegrasyon bakım maliyetiyle karşılaştırmanızı öneririm. Tek platform genellikle toplam sahip olma maliyetinde avantaj sağlar."

### "Ekip Jira'yı biliyor, geçiş zor"
> "Geçiş maliyeti gerçek bir kriter. Bununla birlikte, kalite ve traceability ihtiyacınız güçse, mevcut araç zincirine eklenti koymanın da kademeli bir maliyeti var. İkisini kıyaslamak için birlikte baksak?"

### "Manifest karmaşık görünüyor"
> "Manifest bir eşik getiriyor, bu doğru. Ama bir kez tanımlandıktan sonra ekiplerin süreci projeye göre yönetmesine izin veriyor. Hazır şablon ile başlayıp ihtiyaca göre uyarlanabiliyor."

### "Küçük ekip için aşırı karmaşık"
> "Küçük ekipler için core backlog ve board yeterli olabilir; kalite ve traceability katmanı zorunlu değil. Başlangıçta sadeleştirilmiş konfigürasyonla başlayıp büyüdükçe kapsamı genişletmek mümkün."

### "CI/CD ile entegrasyonunuz yok"
> "ALM doğrudan bir CI/CD platformu değil. SCM linkleri ve deployment event webhook'larıyla mevcut CI/CD zincirinizden bağımsız traceability sağlıyor. Hangi araçları kullandığınıza bakıp webhook entegrasyonunu birlikte değerlendirebiliriz."

---

## 8. ALM'in Hiç Uygun Olmadığı Profiller

Satışta açık olmak güven oluşturur. ALM şu profiller için en uygun tercih değildir:

- Yalnızca 3-5 kişilik geliştirici ekiplerinde sadece issue takibi için (Linear veya GitHub Issues daha hafif)
- Gerçek zamanlı CI/CD otomasyonu platform ihtiyacı olan ekipler (ALM bir CI/CD platformu değil)
- Atlassian ekosistemine (Confluence, Bitbucket) zaten derinden yatırım yapmış ve bu bütünleşmeden vazgeçmek istemeyen ekipler

---

## 9. İlgili Dokümanlar

- [MARKETING_MESSAGE_FRAMEWORK_TR.md](./MARKETING_MESSAGE_FRAMEWORK_TR.md)
- [ONE_PAGER_TR.md](./ONE_PAGER_TR.md)
- [DEMO_SCRIPT_TR.md](./DEMO_SCRIPT_TR.md)
- [ROI_VALUE_ARGUMENTS_TR.md](./ROI_VALUE_ARGUMENTS_TR.md)

↑ [Dokümanlar](README.md)
