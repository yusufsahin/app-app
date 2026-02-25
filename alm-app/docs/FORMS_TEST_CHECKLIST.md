# Form bileşenleri – Manuel test listesi

Paylaşılan form kütüphanesine (Rhf* + FormProvider) taşınan sayfa/dialog’ların hızlı doğrulanması için kontrol listesi.

**Ön koşul:** Backend ve frontend çalışıyor; giriş yapılmış bir kullanıcı var.

---

## 1. Artifacts sayfası

| # | Adım | Beklenen |
|---|------|----------|
| 1 | Artifacts toolbar: Arama kutusuna yaz | Debounce sonrası liste filtrelenir |
| 2 | Saved queries dropdown’dan bir kayıtlı sorgu seç | Filtreler (cycle, area, sort vb.) uygulanır, liste güncellenir |
| 3 | Cycle / Area / Sort by / Order dropdown’larını değiştir | Liste ve (varsa) URL parametreleri güncellenir |
| 4 | "Show deleted" kutusunu işaretle | Silinmiş artifact’lar listelenir |
| 5 | "Clear filters" tıkla | Filtreler temizlenir |
| 6 | Birkaç artifact seç → "Transition" → Bulk transition dialog aç | Dialog açılır |
| 7 | "New state" seç veya common action chip’e tıkla; State reason / Resolution doldur (şemaya göre); "Transition" | Seçili artifact’lar geçiş yapar, dialog kapanır veya sonuç mesajı gösterilir |
| 8 | Bir artifact detayında "Add a comment" alanına yazıp "Add comment" | Yorum eklenir, alan temizlenir |
| 9 | Project members dialog: Bir üyenin rol dropdown’ını değiştir | Rol güncellenir, bildirim gelir |
| 10 | Save current filters → İsim ve visibility gir → Save | Kayıtlı sorgu oluşur; dropdown’da görünür |

---

## 2. Planning sayfası

| # | Adım | Beklenen |
|---|------|----------|
| 1 | Backlog sekmesine geç; "Select a cycle" ile cycle seç | Backlog listesi o cycle’a göre gelir |
| 2 | Backlog satırında bir artifact’ın cycle dropdown’ını değiştir | Artifact o cycle’a atanır, bildirim gelir |
| 3 | Add cycle/area dialog’larında isim girip kaydet | Yeni node oluşur |
| 4 | Rename dialog’da isim değiştirip kaydet | Node adı güncellenir |

---

## 3. Board sayfası

| # | Adım | Beklenen |
|---|------|----------|
| 1 | Type / Cycle / Area filtrelerini değiştir | Kartlar filtrelenir |

---

## 4. Projects sayfası

| # | Adım | Beklenen |
|---|------|----------|
| 1 | Arama ve sort dropdown’larını kullan | Liste ve URL güncellenir |

---

## 5. Auth ve ayarlar

| # | Adım | Beklenen |
|---|------|----------|
| 1 | Login: e-posta/şifre gir → Giriş | Giriş başarılı |
| 2 | Register: formu doldur → Kayıt | Kayıt başarılı |
| 3 | Members (tenant): "Include deleted" kutusunu işaretle | Silinmiş kullanıcılar listelenir (admin) |
| 4 | Invite member / Create user modal’larında formu doldurup gönder | Üye davet edilir / kullanıcı oluşturulur |
| 5 | Create project modal: kod, isim, process template, açıklama → Create | Proje oluşur |
| 6 | Access audit: filtre alanları ve dropdown | Tablo filtrelenir |

---

## 6. Diğer

| # | Adım | Beklenen |
|---|------|----------|
| 1 | Automation: "Add workflow rule" dialog’unda alanları doldur → Add | Kural eklenir |
| 2 | Workflow designer: Workflow ve From/To transition seçip geçiş ekle | Geçiş eklenir |
| 3 | Metadata-driven list (şema ile liste kullanan sayfalar): Filtre dropdown’larını değiştir | Liste filtrelenir |

---

**Not:** Hata görürsen konsol (F12) ve ağ sekmesini kontrol et; form alanı hangi sayfa/dialog’da ise `.cursor/rules/frontend-forms.mdc` ve `frontend/src/shared/components/forms/` referans alınabilir.
