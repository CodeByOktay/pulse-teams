
# Değişiklik Günlüğü (Changelog)

Tüm önemli değişiklikler bu dosyada belgelenir. Format [Keep a Changelog](https://keepachangelog.com/) standardına uygundur.

## [0.2.0] - 2026-09-18 (Faz 2 — Sprint, Görünümler & Ayarlar)

### Eklendi (Added)
- **Sprint / Cycle Yönetimi (Prompt J, K):**
  - `Sprint` ve `SprintTask` modelleri, `SprintStatus` enum'u (`DRAFT`/`ACTIVE`/`COMPLETED`) eklendi.
  - `createSprint`, `updateSprint`, `deleteSprint`, `startSprint`, `completeSprint`, `addTaskToSprint`, `removeTaskFromSprint` server action'ları; iş kuralları (`validateSprintDates`, `canDeleteSprint`, `canStartSprint`) saf fonksiyonlara çıkarıldı.
  - `/projects/[id]/sprints` sayfası: `SprintCard`, `CreateSprintModal`, `EditSprintModal`, `CompleteSprintDialog`, `SprintTaskPicker` bileşenleri; tek seferde yalnızca bir `ACTIVE` sprint kısıtı.
  - `sprint-utils.test.ts` (13 test) ve `sprint-actions.test.ts` (11 test).
- **Liste Görünümü (Prompt L):**
  - `/projects/[id]/list` sayfası: sıralanabilir sütun başlıkları (Başlık, Durum, Öncelik, Bitiş Tarihi), state'e göre collapsible gruplama.
  - `ViewSwitcher` bileşeni ile Board ↔ Liste geçişi, `FilterBar`'ın her iki görünümde yeniden kullanılması.
  - `sortTasksByField` / `groupTasksByState` saf fonksiyonları — null `dueDate` değerleri her zaman sona alınır.
  - `list-view-sort.test.ts` (15 test).
- **Aktivite / Audit Log (Prompt M):**
  - `Activity` modeli ve 15 değerli `ActivityType` enum'u; `task`/`actor` ilişkileri, `taskId` ve `taskId+createdAt` indeksleri.
  - `logActivity(tx, data)` — çağrıldığı `prisma.$transaction` içinde kayıt atar, kendi hatasını yutar ve ana işlemi asla başarısız yapmaz.
  - `formatActivityMessage` — her `ActivityType` için Türkçe okunabilir mesaj üretir, eksik/bilinmeyen veriler için güvenli fallback döner.
  - `createTask`, `updateTask`, `assignUserToTask`/`unassignUserFromTask`, `addLabelToTask`/`removeLabelFromTask`, `createComment`/`deleteComment`, `addTaskToSprint`/`removeTaskFromSprint` aktivite logu üretecek şekilde güncellendi.
  - `TaskDetailModal`'a Aktivite/Yorumlar sekmeleri eklendi; `TaskActivity` bileşeni son 20 aktiviteyi getirir, "Tüm geçmişi göster" ile sayfalanır.
  - `activity-logger.test.ts` (14 test).
- **Toplu İşlemler / Bulk Actions (Prompt N):**
  - `bulkUpdateTasks` (≤100 görev, durum/öncelik/atanan toplu güncelleme) ve `bulkDeleteTasks` (≤50 görev) server action'ları; tüm `taskId`'lerin aynı projeye ait olduğu ve kullanıcının o projede üye olduğu her zaman sunucuda doğrulanır.
  - `useBulkSelection` hook'u ve saf `bulk-selection-logic.ts` (`toggleItem`, `selectAll`, `isAllSelected`, limit doğrulayıcılar).
  - `BulkActionBar` (durum/öncelik/sprint toplu değiştirme, kırmızı toplu silme butonu) ve yeniden kullanılabilir `ConfirmDialog` bileşeni.
  - Liste görünümü satır/başlık checkbox'ları (header'da "tümünü seç" + indeterminate durum desteği).
  - `bulk-selection.test.ts` (18 test).
- **Markdown Desteği (Prompt O):**
  - `react-markdown` + `remark-gfm` entegrasyonu (Next.js 16 Turbopack ile ek yapılandırma gerekmeden native ESM çözümlemesi).
  - `MarkdownEditor` (Yaz/Önizle sekmeleri, auto-resize textarea, Tab → 2 boşluk, seçili metni saran B/I/kod/liste/link araç çubuğu) ve `MarkdownRenderer` (başlık, liste, kod bloğu, blockquote, link için özel stiller).
  - `TaskDescription` yeniden yazıldı: manuel "Kaydet" butonu + "Kaydedilmemiş değişiklikler" rozeti.
  - `stripMarkdown`, `truncateMarkdown` (kelime sınırında ve dengeli `**`/`` ` `` ile güvenli kesme), `countWords` saf fonksiyonları; Kanban kartında düz metin önizleme.
  - `markdown-utils.test.ts` (21 test).
- **Proje Ayarları (Prompt P):**
  - `/projects/[id]/settings` sayfası — yalnızca `ADMIN` rolündeki üyelere açık, diğerlerine erişim engeli ekranı gösterir.
  - `src/actions/state.ts`: `createState`, `updateState`, `deleteState`, `reorderStates` — tümü `requireAdmin` ile korunur; `reorderStates` gönderilen ID kümesini projenin gerçek state'leriyle doğrulayıp `$transaction` içinde toplu günceller.
  - `label.ts`'e `updateLabel` eklendi; `createLabel`/`deleteLabel` ortak `settings-logic.ts` doğrulamalarını kullanacak şekilde güncellendi.
  - `StatesManager` (`@dnd-kit` ile sürükle-bırak sıralama, 500ms debounce), `LabelsManager` (kullanım sayısı gösterimi), `ColorPicker` (hex ↔ renk seçici senkronizasyonu).
  - Sidebar'a yalnızca `ADMIN` rolüne görünen "Ayarlar" bağlantısı eklendi.
  - `validateStateName`, `validateLabelName`, `validateHexColor`, `canDeleteState`, `calculateStateSequences` saf fonksiyonları.
  - `settings-validation.test.ts` (30 test).

### Değişti (Changed)
- `BoardTask` tipine `description` alanı eklendi; Kanban kartı artık açıklama önizlemesi gösteriyor.
- Sidebar, her proje için Board/Liste/Sprints/(Ayarlar) alt bağlantılarını gösterecek şekilde yeniden düzenlendi.

### Test
- Toplam Vitest testi 14'ten **136**'ya çıktı (11 test dosyası), tamamı geçiyor.
- `npx tsc --noEmit` ve `npm run build` her prompt sonrası hatasız doğrulandı.

---

## [0.1.0] - 2026-09-17 (Faz 1 — MVP)

### Eklendi (Added)
- **Altyapı:** Next.js 16 (App Router), Tailwind v4, Prisma 6.19 ve Docker üzerinde PostgreSQL 16.
- **Kimlik Doğrulama:** NextAuth.js ile e-posta/şifre tabanlı kayıt/giriş, bcryptjs (salt 12) şifreleme ve rota koruma middleware'i.
- **Proje Yönetimi:** Proje CRUD, otomatik 5 durum (Backlog, Todo, In Progress, Done, Cancelled) tohumlama ve dashboard.
- **Görev Yönetimi:** Görev CRUD, projeye özgü artan Sequence ID (`PRJ-1`) ve kayan noktalı (`Float`) sıralama algoritması.
- **Etiketler & Atamalar:** Çoklu etiketleme, kullanıcı ataması, deterministik avatar renk motoru ve 10'lu renk paleti.
- **Kanban Panosu:** `@dnd-kit` ile kolon içi/arası sürükle-bırak, iyimser UI (optimistic update) ve hızlı görev ekleme.
- **Görev Detay Modalı:** Slide-over çekmece, inline başlık/açıklama düzenleme ve yazar korumalı yorum sistemi.
- **Filtreleme & UX:** URL tabanlı filtreler (`?priority=...`), sıralama seçici, Header, Breadcrumb ve Empty State bileşenleri.
- **Testler:** Vitest ile 14 adet otomatik birim testi (%100 geçildi).

