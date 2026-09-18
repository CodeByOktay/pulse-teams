# Değişiklik Günlüğü (Changelog)

Bu projedeki tüm önemli değişiklikler bu dosyada belgelenmektedir.  
Format [Keep a Changelog](https://keepachangelog.com/tr/1.0.0/) standardına uygundur ve [Semantic Versioning](https://semver.org/lang/tr/) kurallarını takip eder.

---

## [0.1.0] - 2026-09-17 (Faz 1 — MVP)

### Eklendi (Added)
- **Teknoloji Altyapısı (Prompt A):**
  - Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 mimarisi kuruldu.
  - Prisma ORM (v6.19.3) ve hot-reload güvenli global singleton istemcisi (`src/lib/prisma.ts`) oluşturuldu.
- **Veritabanı ve Şema Mimarisi (Prompt B):**
  - PostgreSQL 16 üzerinde 9 ilişkisel model (`User`, `Project`, `ProjectMember`, `State`, `Task`, `Label`, `TaskLabel`, `TaskAssignee`, `Comment`) tanımlandı.
  - Sütun soyutlaması için `StateGroup` ve görev öncelikleri için `Priority` enum'ları eklendi.
  - Yeni açılan projelere 5 varsayılan sütun (`Backlog`, `Todo`, `In Progress`, `Done`, `Cancelled`) tohumlayan `seedDefaultStates` motoru yazıldı.
- **Kimlik Doğrulama & Oturum (Prompt C):**
  - NextAuth.js ile e-posta ve şifreye dayalı `CredentialsProvider` sistemi entegre edildi.
  - Şifreler `bcryptjs` (salt 12) ile hash'lendi; JWT tabanlı stateless oturum yönetimi kuruldu.
  - `middleware.ts` üzerinden korumalı rota güvenlik duvarı (route guard) eklendi.
  - Giriş ve kayıt formları, istemci validasyonu ve hata bildirimleri tamamlandı.
- **Proje Yönetimi & Dashboard (Prompt D):**
  - `createProject` sunucu eylemi ile atomik transaction (`$transaction`) içinde proje açma, durum tohumlama ve yönetici (`ADMIN`) üyeliği bağlandı.
  - 256px koyu temalı `Sidebar`, aktif proje vurgusu ve kullanıcı çıkış aksiyonu eklendi.
  - Dashboard üzerinde görev sayaçları (`_count: { tasks: true }`) ve `EmptyState` entegrasyonu sağlandı.
- **Görev Yönetimi & Sıralama (Prompt E):**
  - Proje kapsamlı artan numara üreten `getNextSequenceId` motoru (`PRJ-1`, `PRJ-2`) yazıldı.
  - Kayan noktalı (`Float`) `sortOrder` matematiksel sıralama algoritması eklendi.
  - `createTask`, `updateTask`, `deleteTask` ve `reorderTask` server action'ları yetkilendirme (`requireMembership`) ile korundu.
- **Etiketler & Atamalar (Prompt F):**
  - Çoklu etiketleme ve görevli atama (M2M) yapısı kuruldu; mükerrer istekler için idempotent hata yönetimi sağlandı.
  - Kullanıcı adlarından bitwise matematiksel hash üreten deterministik avatar renk motoru (`getAvatarColor`) ve 10'lu onaylı renk paleti eklendi.
  - Açılır menü seçiciler (`LabelPicker`, `AssigneePicker`) ve dış tıklama algılayıcı (`useClickOutside`) geliştirildi.
- **Kanban Panosu & Sürükle-Bırak (Prompt G):**
  - `@dnd-kit` ile kolon içi ve kolonlar arası akıcı sürükle-bırak desteği tamamlandı.
  - Ağ gecikmesini hissettirmeyen İyimser UI Güncellemesi (Optimistic Updates) ve hata geri alma (rollback) güvencesi kuruldu.
  - Sütun altından kesintisiz hızlı görev girişi (`AddTaskInline`) ve kart üzeri mikro etkileşimler (hover silme, renkli bitiş tarihleri, öncelik ikonları) eklendi.
- **Görev Detay Modalı & Yorumlar (Prompt H):**
  - 720px sağdan kayan slide-over çekmece paneli geliştirildi.
  - Tıkla-düzenle inline başlık ve `onBlur` ile otomatik kaydeden açıklama textarea'sı eklendi.
  - Görev tartışma/yorum akışı kuruldu; kullanıcıların yalnızca kendi yorumlarını silebilmesini sağlayan çift katmanlı (UI + Server Action) güvenlik kalkanı uygulandı.
- **Filtreleme, Sıralama & Navigasyon (Prompt I):**
  - URL arama parametreleri tabanlı (`?priority=...&label=...&sort=...`) yer imlerine eklenebilir filtreleme motoru kuruldu.
  - `Header`, hiyerarşik `Breadcrumb` ve 3 farklı senaryoya özel `EmptyState` eklendi.
- **Test Altyapısı:**
  - Projeye **Vitest** entegre edildi. Filtreleme, sıra numarası, kayan noktalı sıralama ve renk motoru için 14 adet otomatik birim testi yazıldı (%100 başarı).

---

[0.1.0]: https://github.com
