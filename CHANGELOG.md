
# Değişiklik Günlüğü (Changelog)

Tüm önemli değişiklikler bu dosyada belgelenir. Format [Keep a Changelog](https://keepachangelog.com/) standardına uygundur.

## [0.4.3] - 2026-09-21 (Faz 4.03 — Bildirim Tercihleri, Mention Desteği & Yaklaşan Son Tarih)

### Eklendi (Added)
- **Kullanıcı Bildirim Tercihleri Modeli:** `UserNotificationPreference` tablosu (`notifyTaskAssigned`, `notifyCommentAdded`, `notifyMentioned`, `notifyDueDateApproaching`, `notifySprintClosed`) ve `User.notificationPreferences` 1-e-1 ilişkisi.
- **Bildirim Tipleri:** `NotificationType` enum'ına `TASK_MENTIONED` ve `DUE_DATE_APPROACHING` değerleri eklendi.
- **Saf İş Mantığı (`src/lib/notification-logic.ts`):** `extractMentions` (tırnaklı boşluklu ve tekil handle tespiti, deduplication), `resolveMentionedUserIds` (proje üyeleriyle büyük/küçük harf duyarsız ve ilk ad eşleştirmesi), `shouldDeliverWithPreferences` (kendi kendine bildirim yasağı + kullanıcı tercih kontrolü), `getApproachingDueTasks` (0, 1 ve 3 gün kalan takvim günü hesaplaması), `formatDueDateNotificationSnippet`.
- **Server Actions:** `getUserNotificationPreferences`, `updateUserNotificationPreferences`, `checkApproachingDueDates` (günlük tekrarsız bildirim kontrolü); `createComment` mention ayrıştırması ve çift bildirim engellemesi (`!mentionedSet.has(assignee.userId)`), `assignUserToTask` ve `completeSprint` eylemlerinde tercih denetimi.
- **Arayüz (UI):** `NotificationPreferencesModal` (5 bildirim anahtarı, anında iyimser güncelleme ve rollback), `NotificationPopover` başlığında ayarlar dişlisi, `NotificationItem` bileşeninde `AtSign` (indigo) ve `Clock` (amber) ikonları.
- **Test:** `notification-preferences.test.ts` (29 test). Toplam test sayısı 393'e çıktı (%100 geçiyor).

## [0.4.2] - 2026-09-21 (Faz 4.02 — Uygulama İçi Bildirimler & İstemci Polling)

### Eklendi (Added)
- **Uygulama İçi Bildirim Modeli:** `Notification` tablosu ve `NotificationType` enum'u (`TASK_ASSIGNED`, `COMMENT_ADDED`, `SPRINT_COMPLETED`); `[userId, read]` ve `[userId, createdAt]` indeksleri.
- **Saf Bildirim Mantığı (`src/lib/notification-logic.ts`):** `shouldDeliverNotification` (kendi kendine bildirim engeli), `formatNotificationSnippet` (Markdown temizleme ve 80 karakter kelime sınırında kesme), `buildNotificationDeepLink`, `buildSprintNotificationDeepLink`, `countUnreadNotifications`.
- **Server Actions (`src/actions/notification.ts`):** `getNotifications`, `getUnreadNotificationCount`, `markNotificationAsRead`, `markAllNotificationsAsRead`, ve dayanıklı (hata yutan) `createNotification` / `createNotifications` yardımcıları.
- **Otomatik Tetikleyiciler:** `assignUserToTask` (`TASK_ASSIGNED`), `createComment` (`COMMENT_ADDED`), `completeSprint` (`SPRINT_COMPLETED`) aksiyonlarına bildirim kancaları bağlandı.
- **İstemci Polling Hook'u (`src/lib/use-notification-polling.ts`):** 30 saniyelik hafif sorgulama, sekme gizlendiğinde (`document.hidden`) duraklama, sekmeye dönüldüğünde anında tazeleme.
- **Header Bildirim Bileşeni:** `NotificationBell` (kırmızı sayaç rozeti, `9+` desteği), `NotificationPopover` (360px açılır liste, "Tümünü Okundu İşaretle", göreve doğrudan geçiş linki).
- **Test:** `notification-logic.test.ts` (16 test). Toplam test sayısı 364'e çıktı.

## [0.4.1] - 2026-09-21 (Faz 4.01 — Gerçekçi Analitik Veri Seti & Jeneratörler)

### Eklendi (Added)
- **Deterministik Tohumlama Motoru (`prisma/seed-data-generators.ts`):** `mulberry32` PRNG (seed: 42), 10 kullanıcı personası (`password123`), 5 proje (`CORE`, `ANL`, `AI`, `ADM`, `MOB`), 8 Kanban durumu, 30 etiket, ağırlıklı görev tipleri ve öncelikler, GFM checklist (~%40) ve ek dosya (~%30) üreticileri.
- **Prisma Orkestrasyonu (`prisma/seed-realistic-data.ts`):** Idempotent temizlik, toplu ekleme (`createMany`), `wouldCreateBlockCycle` ile döngüsüz bağımlılıklar, 10 sprintlik (Ocak-Mayıs) tarihsel dağılım ve tek aktif sprint kısıtına tam uyum.
- **Cross-Platform Script:** `prisma/tsconfig.seed.json` ile `npm run db:seed-rich` komutu.
- **Test:** `seed-data-generators.test.ts` (17 test). Toplam test sayısı 348'e çıktı.

## [0.3.0] - 2026-09-20 (Faz 3 — UX/UI Kalitesi & Proje Yönetimi Yetenekleri)

### Eklendi (Added)
- **Üye Yönetimi & Davet Sistemi (Faz 3.01):**
  - `ProjectInvite` modeli ve `InviteStatus` enum'u (`PENDING`/`ACCEPTED`/`EXPIRED`); 32 byte hex token, 7 gün geçerlilik.
  - `src/actions/member.ts`: `inviteMember`, `acceptInvite`, `removeMember`, `changeMemberRole`, `cancelInvite` — tümü `ADMIN` kontrolü ile korunur; proje sahibi çıkarılamaz ve rolü değiştirilemez.
  - `/invite/[token]` sayfası: token geçerliliği, e-posta eşleşmesi ve oturum durumu için ayrı ayrı UI senaryoları.
  - `MembersManager` bileşeni ve Ayarlar sayfasına "Üyeler" sekmesi.
  - `member-management.test.ts` (28 test).
- **Görev Detayı Premium UX (Faz 3.02):**
  - `InlineSelectPopover` ortak bileşeni üzerine kurulu `StatusPicker` / `PriorityPicker` — klavye navigasyonu, iyimser güncelleme ve hata halinde geri alma (`resolveOptimisticState`); aynı değer tekrar seçilirse mutasyon atlanır.
  - `DateField` (tıkla-düzenle tarih seçici), `CopyLinkButton`, modal başlığında breadcrumb ve `resolveTaskSprintBadge` ile tek sprint rozeti (`ACTIVE` > `DRAFT` > Backlog).
  - Board ve Liste görünümleri `?task=` query param'ı ile derin bağlantı desteği kazandı.
  - `task-detail-ux.test.ts` (19 test).
- **Backlog Görünümü & Sprint Entegrasyonu (Faz 3.03):**
  - `/projects/[projectId]/backlog` route'u; backlog tanımı "hiçbir `ACTIVE`/`DRAFT` sprint'e bağlı olmayan görev".
  - `moveTaskToSprint` / `moveTaskToBacklog` server action'ları — `$transaction` içinde çalışır ve `COMPLETED` sprint geçmişini asla silmez (`getRemovableSprintIds`).
  - `SprintProgressCard` ilerleme kartları ve `MoveToSprintMenu`.
  - `backlog-logic.test.ts` (23 test).
- **Global Arama & Komut Paleti (Faz 3.04):**
  - `globalSearch` server action'ı — görev başlığı substring'i veya `PRJ-12` tanımlayıcısı ile eşleşme; kullanıcı üyeliği her zaman `where` cümlesinde filtrelenir.
  - `CommandPalette` bileşeni: `Ctrl+K` / `Cmd+K` kısayolu, kategorize sonuçlar, ok tuşlarıyla döngüsel gezinme ve proje bazlı hızlı aksiyonlar.
  - `search-logic.test.ts` (24 test).
- **Dashboard Yenileme & Analytics (Faz 3.05):**
  - `analytics-logic.ts`: `isTaskOverdue`/`countOverdueTasks`, `calculateCompletionRate`, `calculateSprintBurndown`, `calculateProjectVelocity`, `formatRelativeTime`.
  - 4 istatistik kartı (tümü `prisma.count` ile), "Bana Atananlar" widget'ı, "Son Aktiviteler" akışı ve "Sprint Hızı" paneli — harici grafik kütüphanesi kullanılmadan, saf Tailwind ile.
  - `dashboard-analytics.test.ts` (25 test).
- **Gelişmiş Filtreler & Kayıtlı Görünümler (Faz 3.06):**
  - `BoardFilters` genişletildi: durum grubu, bitiş tarihi (`overdue`/`today`/`this_week`/`no_date`) ve metin araması; `resolveDueDateRange` ile tarih sınırları (hafta Pazartesi başlar).
  - `QuickFilterChips`, `GroupFilter`, `DueDateFilter`, `SearchInput` bileşenleri.
  - `useSavedViews` hook'u ile `localStorage` tabanlı, proje bazlı kayıtlı görünümler; `__me__` yer tutucusu oturum kullanıcısına çözülür.
  - `advanced-filters.test.ts` (36 test).
- **Görev İlişkileri & Bağımlılıklar (Faz 3.07):**
  - `TaskRelation` modeli ve `RelationType` enum'u (`BLOCKS`/`RELATES_TO`/`DUPLICATES`); her ilişki tek yönlü **tek** kayıttır — "Tarafından engelleniyor" ayrı bir tip değil, `BLOCKS` kaydının hedef tarafındaki görünümüdür.
  - `relation-logic.ts`: `getRelationLabel`, `hasExistingRelation` (tek çift kuralı — yönden ve tipten bağımsız), `wouldCreateBlockCycle` (**iteratif DFS**; rekürsiyon yok, 1000+ düğümlü zincirde stack overflow olmaz, mevcut veride döngü olsa bile `visited` seti sonsuz döngüyü engeller), `groupRelationsForTask`.
  - `src/actions/relation.ts`: `addTaskRelation`, `removeTaskRelation`, `searchTasksForRelation` — `projectId` istemciden değil, doğrulanmış görev kaydından alınır; iki görevin aynı projede olması zorunludur.
  - `TaskRelations` bileşeni: 4 gruplu görünüm, iyimser silme ve debounce'lu arama içeren "İlişki Ekle" popover'ı; ilişkili göreve tıklanınca modal o göreve geçer.
  - `task-relations.test.ts` (40 test).

### Değişti (Changed)
- `ActivityType` enum'u 15'ten 17 değere çıktı (`TASK_RELATION_ADDED`, `TASK_RELATION_REMOVED`).
- `getTaskDetail` sorgusuna `project.name`, `sprints` ve `sourceRelations`/`targetRelations` ilişkileri eklendi.
- `buildTaskWhereFromFilters` tüm filtreleri tek `Prisma.TaskWhereInput`'a indirger; Board ve Liste sayfalarındaki tekrarlı `where` cümlesi kodu kaldırıldı.
- `formatRelativeTime` ortak fonksiyona taşındı; `task-activity.tsx` içindeki kopyası kaldırıldı.

### Kaldırıldı (Removed)
- OAuth / harici kimlik sağlayıcı entegrasyonu (Google, GitHub, Microsoft) proje kapsamından ve yol haritasından tamamen çıkarıldı. Kimlik doğrulama yalnızca NextAuth `CredentialsProvider` (e-posta/şifre + bcrypt) ile yapılır.

### Veritabanı (Migrations)
- `20260919213140_add_project_invite` — `ProjectInvite` tablosu ve `InviteStatus` enum'u.
- `20260920004710_add_task_relations` — `RelationType` enum'u, `TaskRelation` tablosu, indeksler ve `ActivityType` genişletmesi. Yalnızca ekleme yapar, veri kaybı yoktur.

### Test
- Toplam Vitest testi 136'dan **331**'e çıktı (18 test dosyası), tamamı geçiyor.
- `npx tsc --noEmit` ve `npm run build` hatasız doğrulandı.

---

## [0.2.0] - 2026-09-18 (Faz 2 — Sprint, Görünümler & Ayarlar)

### Eklendi (Added)
- **Sprint / Cycle Yönetimi (Faz 2.01, Faz 2.02):**
  - `Sprint` ve `SprintTask` modelleri, `SprintStatus` enum'u (`DRAFT`/`ACTIVE`/`COMPLETED`) eklendi.
  - `createSprint`, `updateSprint`, `deleteSprint`, `startSprint`, `completeSprint`, `addTaskToSprint`, `removeTaskFromSprint` server action'ları; iş kuralları (`validateSprintDates`, `canDeleteSprint`, `canStartSprint`) saf fonksiyonlara çıkarıldı.
  - `/projects/[id]/sprints` sayfası: `SprintCard`, `CreateSprintModal`, `EditSprintModal`, `CompleteSprintDialog`, `SprintTaskPicker` bileşenleri; tek seferde yalnızca bir `ACTIVE` sprint kısıtı.
  - `sprint-utils.test.ts` (13 test) ve `sprint-actions.test.ts` (11 test).
- **Liste Görünümü (Faz 2.03):**
  - `/projects/[id]/list` sayfası: sıralanabilir sütun başlıkları (Başlık, Durum, Öncelik, Bitiş Tarihi), state'e göre collapsible gruplama.
  - `ViewSwitcher` bileşeni ile Board ↔ Liste geçişi, `FilterBar`'ın her iki görünümde yeniden kullanılması.
  - `sortTasksByField` / `groupTasksByState` saf fonksiyonları — null `dueDate` değerleri her zaman sona alınır.
  - `list-view-sort.test.ts` (15 test).
- **Aktivite / Audit Log (Faz 2.04):**
  - `Activity` modeli ve 15 değerli `ActivityType` enum'u; `task`/`actor` ilişkileri, `taskId` ve `taskId+createdAt` indeksleri.
  - `logActivity(tx, data)` — çağrıldığı `prisma.$transaction` içinde kayıt atar, kendi hatasını yutar ve ana işlemi asla başarısız yapmaz.
  - `formatActivityMessage` — her `ActivityType` için Türkçe okunabilir mesaj üretir, eksik/bilinmeyen veriler için güvenli fallback döner.
  - `createTask`, `updateTask`, `assignUserToTask`/`unassignUserFromTask`, `addLabelToTask`/`removeLabelFromTask`, `createComment`/`deleteComment`, `addTaskToSprint`/`removeTaskFromSprint` aktivite logu üretecek şekilde güncellendi.
  - `TaskDetailModal`'a Aktivite/Yorumlar sekmeleri eklendi; `TaskActivity` bileşeni son 20 aktiviteyi getirir, "Tüm geçmişi göster" ile sayfalanır.
  - `activity-logger.test.ts` (14 test).
- **Toplu İşlemler / Bulk Actions (Faz 2.05):**
  - `bulkUpdateTasks` (≤100 görev, durum/öncelik/atanan toplu güncelleme) ve `bulkDeleteTasks` (≤50 görev) server action'ları; tüm `taskId`'lerin aynı projeye ait olduğu ve kullanıcının o projede üye olduğu her zaman sunucuda doğrulanır.
  - `useBulkSelection` hook'u ve saf `bulk-selection-logic.ts` (`toggleItem`, `selectAll`, `isAllSelected`, limit doğrulayıcılar).
  - `BulkActionBar` (durum/öncelik/sprint toplu değiştirme, kırmızı toplu silme butonu) ve yeniden kullanılabilir `ConfirmDialog` bileşeni.
  - Liste görünümü satır/başlık checkbox'ları (header'da "tümünü seç" + indeterminate durum desteği).
  - `bulk-selection.test.ts` (18 test).
- **Markdown Desteği (Faz 2.06):**
  - `react-markdown` + `remark-gfm` entegrasyonu (Next.js 16 Turbopack ile ek yapılandırma gerekmeden native ESM çözümlemesi).
  - `MarkdownEditor` (Yaz/Önizle sekmeleri, auto-resize textarea, Tab → 2 boşluk, seçili metni saran B/I/kod/liste/link araç çubuğu) ve `MarkdownRenderer` (başlık, liste, kod bloğu, blockquote, link için özel stiller).
  - `TaskDescription` yeniden yazıldı: manuel "Kaydet" butonu + "Kaydedilmemiş değişiklikler" rozeti.
  - `stripMarkdown`, `truncateMarkdown` (kelime sınırında ve dengeli `**`/`` ` `` ile güvenli kesme), `countWords` saf fonksiyonları; Kanban kartında düz metin önizleme.
  - `markdown-utils.test.ts` (21 test).
- **Proje Ayarları (Faz 2.07):**
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
- `npx tsc --noEmit` ve `npm run build` her faz adımı sonrası hatasız doğrulandı.

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

