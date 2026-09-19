# Pulse — Faz 3 Claude Uygulama Promptları

Bu dosya, Pulse v0.3.0-dev aşamasında Faz 3 özelliklerinin sırayla Claude'a yazdırılması için hazırlanmış eksiksiz prompt paketidir.

---

## Faz 3 İlerleme ve Durum Tablosu

| Prompt | Özellik | Kapsam | Durum | Commit |
|:---:|:---|:---|:---:|:---:|
| **Q** | **Üye Yönetimi & Davet Sistemi** | `ProjectInvite` modeli, 5 action, `/invite/[token]`, MembersManager, 28 test | **TAMAMLANDI** | `2168f24` |
| **R** | **Task Detail Premium UX** | Linear tarzı inline seçiciler, breadcrumb, copy link, sprint gösterimi | Bekliyor | - |
| **S** | **Backlog & Sprint Entegrasyonu** | `/projects/[id]/backlog`, sprint progress bar, görev taşıma, 15 test | Bekliyor | - |
| **T** | **Global Arama & Komut Paleti** | `Cmd+K` / `Ctrl+K`, fuzzy arama, hızlı aksiyonlar, 12 test | Bekliyor | - |
| **U** | **Dashboard Yenileme & Analytics** | Stats overview, Bana Atananlar, aktivite akışı, velocity/burndown | Bekliyor | - |
| **V** | **Gelişmiş Filtreler & Kayıtlı Görünümler**| Çoklu filtreler, StateGroup/Tarih aralığı, Kayıtlı Görünümler (Saved Views) | Bekliyor | - |
| **W** | **Task Relations (Bağımlılıklar)** | `TaskRelation` modeli, Blocks/Relates to, döngü engelleme (cycle check) | Bekliyor | - |
| **X** | **Kullanıcı Profili & Şifre Değiştirme** | `/profile`, profil güncelleme, bcrypt ile şifre değiştirme | Bekliyor | - |

---

## HER PROMPTUN BAŞINA EKLENECEK ORTAK TALİMAT BLOĞU

> **Claude'a Gönderim Kuralı:** Aşağıdaki her bir promptu Claude'a gönderirken en baştaki bu bloğu eksiksiz dahil edin. Otomatik test ve commit kuralı bu bloğa eklenmiştir.

```text
Proje: C:\Pulse
Ürün: Pulse Project Management Application
Mevcut sürüm: v0.3.0-dev (Faz 3 devam ediyor)
Stack: Next.js 16 App Router, TypeScript, Tailwind CSS v4, Prisma v6,
PostgreSQL 16, NextAuth JWT CredentialsProvider, Vitest ve @dnd-kit.
 
Başlamadan önce:
 
1. CLAUDE.md dosyasını oku.
2. context.md dosyasını oku.
3. Mevcut Prisma şemasını, ilgili server action dosyalarını, component yapısını
ve test düzenini incele.
4. Mevcut mimariyi doğrulamadan kod yazmaya başlama.
5. Var olan dosya ve fonksiyon adlarını tahmin etme, repository üzerinden doğrula.
6. Mevcut çalışan özellikleri bozacak geniş refactor yapma.
7. Farklı bir yaklaşım gerekiyorsa önce riskleri ve gerekçeyi açıkla.
 
Tüm uygulamada şu kuralları koru:
 
- Her server action kullanıcı oturumunu doğrulamalı.
- Proje verilerine erişimde requireMembership(projectId, userId) kullanılmalı.
- Yönetici işlemlerinde requireAdmin(projectId, userId) kullanılmalı.
- Client tarafından gelen projectId, taskId, sprintId ve userId değerlerine
doğrudan güvenilmemeli.
- Önemli mutasyonlar prisma.$transaction içinde yapılmalı.
- Önemli mutasyonlar logActivity(tx, data) ile kaydedilmeli.
- logActivity ana işlemi başarısız hale getirmemeli.
- Mutasyonlardan sonra gerekli revalidatePath() çağrıları yapılmalı.
- Yeni business logic mümkün olduğunca pure function olarak src/lib altında tutulmalı.
- Yeni business logic için Vitest testleri yazılmalı.
- TypeScript strict typing korunmalı.
- any kullanımından kaçınılmalı.
- Gereksiz dependency, global state veya premature abstraction eklenmemeli.
- Mevcut slate-900 koyu tema ve Linear/Jira benzeri kompakt tasarım dili korunmalı.
- UI responsive, erişilebilir ve keyboard-friendly olmalı.
- Kullanıcıya gösterilen metinler Türkçe olmalı.
- Teknik isimler, dosya isimleri ve kod isimleri İngilizce kalmalı.
 
Özellik tamamlandıktan sonra sırasıyla çalıştır:
 
npm test
npx tsc --noEmit
npm run build
 
Her komutun sonucunu ayrı ayrı raporla.
 
Test veya build hatası çıkarsa hatayı gizleme, testi silme veya type safety'yi
zayıflatma. Kök nedeni düzeltip doğrulama komutlarını yeniden çalıştır.

TÜM KONTROLLER (test, tsc, build) BAŞARIYLA TAMAMLANDIKTAN SONRA:
Otomatik olarak git commit oluştur:
git add .
git commit -m "feat: (Prompt <KOD>) <özellik adı ve eklenen test sayısı>"

Commit çıktısını ve hash bilgisini raporuna ekle.
 
İşin sonunda şu formatta rapor ver:
 
1. Yapılan değişiklikler
2. Oluşturulan dosyalar
3. Değiştirilen dosyalar
4. Prisma migration bilgisi
5. Eklenen testler
6. Test, type-check ve build sonuçları
7. Git commit hash ve mesajı
8. Bilinen sınırlamalar
9. Sonraki özellikle olası entegrasyon noktaları
```

---

## PROMPT R: Task Detail UX Yenileme

```text
[YUKARIDAKİ ORTAK TALİMAT BLOĞUNU BURAYA EKLEYİN]

# FAZ 3 PROMPT R: Task Detail UX Yenileme

Pulse Task Detail deneyimini Linear benzeri, kompakt ve hızlı bir yapıya dönüştür.

Bu prompt ağırlıklı olarak frontend ve UX geliştirmesidir. Gereksiz Prisma migration oluşturma. Mevcut task actions ve veri modelini mümkün olduğunca yeniden kullan.

## Ön İnceleme
- `src/components/task-detail/task-detail-modal.tsx`
- `src/components/task-detail/task-properties.tsx`
- `src/actions/task.ts` (`getTaskDetail` içine `sprints: { include: { sprint: true } }` dahil edilmeli)
- `src/components/labels/label-picker.tsx` ve `src/components/assignees/assignee-picker.tsx`

## 1. StatusBadge Inline Selector
Task Detail içinde mevcut state alanını Linear benzeri inline seçici yap.
Gereksinimler:
- Mevcut state renkleri ve adı gösterilmeli.
- Tıklanınca erişilebilir dropdown/popover açılmalı.
- Projenin kullanılabilir state'leri listelenmeli.
- Seçimden sonra mevcut server action (`updateTask`) kullanılmalı.
- Optimistic update varsa hata halinde rollback uygulanmalı.
- Klavye navigasyonu (Arrow keys, Enter, Esc) desteklenmeli.
- Aynı state tekrar seçilirse gereksiz mutation yapılmamalı.

## 2. PriorityBadge Inline Selector
Priority alanını standart select'ten çıkarıp inline seçiciye dönüştür.
Gereksinimler:
- Her priority görsel olarak ayırt edilebilir renk ve ikona sahip olmalı (NONE, LOW, MEDIUM, HIGH, URGENT).
- Popover ile tıklandığında hızlıca değiştirilebilmeli.
- Klavye ile gezinilebilmeli.
- Başarısız güncellemede eski değer geri gelmeli (rollback).

## 3. TaskProperties Panel Düzeni
TaskProperties panelini kompakt ve hizalı şekilde yenile.
- Durum (Inline Popover)
- Öncelik (Inline Popover)
- Atananlar (Mevcut AssigneePicker)
- Etiketler (Mevcut LabelPicker)
- Sprint (Aktif sprint adı rozeti veya "Backlog" fallback)
- Başlangıç Tarihi & Bitiş Tarihi (Kompakt tarih seçici)
- Oluşturulma Tarihi (Formatlanmış Türkçe tarih)
- Boş değerler için şık placeholder ("Atanmamış", "Sprint Yok", "Tarih Belirtilmedi").

## 4. Üst Bar ve İşlemler
Task Detail üst bölümüne şunları ekle:
- Proje ve görev identifier içeren breadcrumb (`[Proje Adı] / [PRJ-12]`).
- "Bağlantıyı Kopyala" (Copy Link) butonu: Görevin tam URL'sini panoya kopyalar ve 2 saniyelik "Kopyalandı!" rozeti gösterir. Hard-coded localhost kullanma (`window.location.origin` kullan).
- Kapatma butonu (X) ve Esc tuşu desteği.

## 5. Sprint Bilgisi
- `getTaskDetail` sorgusu sprint ilişkisini çekmelidir.
- Görev bir sprintte ise: Sprint adı ve durum rozeti (ACTIVE/DRAFT).
- Görev hiçbir aktif/taslak sprintte değilse: "Backlog" rozeti gösterilmelidir.

## 6. Testler
`src/lib/__tests__/task-detail-ux.test.ts` dosyasını oluştur. En az 10 anlamlı test yaz:
- Aynı state/priority seçildiğinde mutation gereksizliği testi
- Sprint durumu belirleme mantığı (Active/Draft sprint vs. Backlog fallback)
- Breadcrumb ve URL üretimi helper testleri
- Boş property formatlama ve tarih string dönüşümleri
- Optimistic rollback state helper testleri

## Kabul Kriterleri
- State ve priority modal içinden hızlıca değiştirilebiliyor.
- Properties panel Linear standartlarında kompakt ve şık.
- Task bağlantısı güvenilir şekilde panoya kopyalanabiliyor.
- Sprint / Backlog durumu doğru yansıtılıyor.
- 164 mevcut test bozulmuyor, tüm testler geçiyor, tsc ve build hatasız.
- Başarılı olunca commit oluşturuluyor: `git commit -m "feat: (Prompt R) modernize task detail UX with inline selectors, copy link and tests"`
```

---

## PROMPT S: Backlog Görünümü ve Sprint Entegrasyonu

```text
[YUKARIDAKİ ORTAK TALİMAT BLOĞUNU BURAYA EKLEYİN]

# FAZ 3 PROMPT S: Backlog Görünümü ve Sprint Entegrasyonu

Pulse'a sprintlerden bağımsız görev havuzunun yönetilebildiği bir Backlog görünümü ekle.
Amaç: Kullanıcının backlog görevlerini görüntülemesi, sprintler ile backlog arasında görevleri güvenli ve hızlı şekilde taşımasıdır.

## Ön İnceleme
- `src/actions/sprint.ts` (`addTaskToSprint`, `removeTaskFromSprint`, `startSprint`)
- `src/components/sprints/`
- `src/components/layout/sidebar.tsx` ve `src/components/layout/view-switcher.tsx`
- `SprintTask` modelinin geçmiş completed sprint kayıtlarını koruma kuralı

## 1. Backlog Route
- `/projects/[projectId]/backlog` route'unu oluştur.
- Sadece proje üyeleri erişebilir (`requireMembership`).
- **Backlog Görevi Tanımı:** Hiçbir aktif (`ACTIVE`) veya taslak (`DRAFT`) sprinte bağlı olmayan görevler (`sprints: { none: { sprint: { status: { in: ["ACTIVE", "DRAFT"] } } } }`). Geçmiş tamamlanmış (`COMPLETED`) sprint kayıtları olan görevler de şu an bir sprintte değillerse Backlog'da listelenir.

## 2. Görev Taşıma İşlemleri (Server Actions)
`src/actions/sprint.ts` (veya `src/actions/backlog.ts`) içine:
- `moveTaskToSprint(taskId: string, targetSprintId: string)`: Görevi mevcut aktif/taslak sprintinden çıkartıp hedef sprinte ekler.
- `moveTaskToBacklog(taskId: string)`: Görevi bağlı olduğu aktif/taslak sprintten çıkartır (completed sprint geçmişi asla silinmez).
- Her işlem `$transaction` içinde yapılmalı, `TASK_SPRINT_ADDED` veya `TASK_SPRINT_REMOVED` loglanmalı ve `revalidatePath` çağrılmalıdır.

## 3. Backlog Sayfası Arayüzü
- Üst Bölüm: Projenin Aktif ve Taslak Sprintleri (Kompakt kartlar halinde, içindeki görev sayıları ve ilerleme çubuğu).
- Alt Bölüm: "Backlog" görev havuzu tablosu/listesi.
- Her görev satırında: ID, Başlık, Durum rozeti, Öncelik rozeti, Atanan avatarları ve "Sprint'e Taşı" açılır menüsü.
- Göreve tıklandığında mevcut `TaskDetailModal` açılmalı.

## 4. Sprint İlerleme Çubuğu (Progress Bar)
Sprint kartlarında görsel ve metinsel ilerleme bilgisi:
- Toplam görev sayısı
- Tamamlanan görev sayısı (`state.group === "DONE"`)
- Yüzde tamamlama oranı (`(done / total) * 100`)
- Sıfır görevli sprintte division by zero engellenmeli.

## 5. Sidebar & Navigasyon
- `Sidebar` bileşenine "Backlog" linki ekle (`Inbox` veya `Layers` ikonu ile).
- `activeSection === "backlog"` olduğunda aktif stil vurgulanmalı.
- `ViewSwitcher` bileşenine "Backlog" seçeneği entegre edilmeli.

## 6. Testler
`src/lib/__tests__/backlog-logic.test.ts` dosyasını oluştur. En az 15 test yaz:
- Backlog filtreleme predicate mantığı (Active/Draft vs Completed sprint ayrımı)
- Sprint progress hesaplama pure fonksiyonu (0 görev, %100 tamamlanma, ara yüzdeler)
- Sprint taşıma kuralları (Hedef sprint uygunluk kontrolü)
- Tamamlanmış sprint verilerinin silinmezlik kuralı doğrulaması

## Kabul Kriterleri
- Backlog sayfasında sadece aktif/taslak sprintte olmayan görevler listelenmeli.
- Görevler menüden Backlog ile Sprint arasında taşınabilmeli.
- Sidebar'da Backlog linki çalışmalı.
- npm test, npx tsc --noEmit ve npm run build hatasız tamamlanmalı.
- Otomatik commit: `git commit -m "feat: (Prompt S) add backlog view, sprint task movement, progress bars and tests"`
```

---

## PROMPT T: Global Arama & Komut Paleti (Cmd+K)

```text
[YUKARIDAKİ ORTAK TALİMAT BLOĞUNU BURAYA EKLEYİN]

# FAZ 3 PROMPT T: Global Arama & Komut Paleti (Cmd+K)

Pulse'a Linear / Raycast tarzı klavye odaklı Global Arama ve Komut Paleti (`Cmd+K` / `Ctrl+K`) ekle.

## Ön İnceleme
- `src/components/layout/header.tsx` ve `src/app/(main)/layout.tsx`
- `src/actions/task.ts` ve `src/actions/project.ts`

## 1. Klavye Kısayolu ve Tetikleyici
- Global klavye dinleyici: `Cmd+K` (Mac) ve `Ctrl+K` (Windows/Linux) basıldığında modal açılır.
- Header veya Sidebar içine kompakt bir "Ara... (Ctrl+K)" butonu yerleştir.
- `Escape` tuşuna basıldığında modal kapanır.

## 2. Server Action: `globalSearch(query: string)`
- `src/actions/search.ts` dosyasını oluştur.
- Kullanıcı oturumunu doğrula.
- Kullanıcının üyesi olduğu projeler içindeki:
  - Görevleri (Başlıkta veya Identifier'da arama: örn. `PRJ-4` veya `login hatası`)
  - Projeleri (Ad veya Identifier eşleşmesi)
  - Hızlı Navigasyon Komutlarını ("Board'a git", "Sprintlere git", "Ayarlar'a git")
- Query en az 2 karakter olmalıdır. Sonuçlar maksimum 10 görev ve 5 proje ile sınırlandırılmalıdır.

## 3. Komut Paleti Arayüzü (`CommandPalette.tsx`)
- Modern, yarı saydam koyu backdrop ve merkezde arama kutusu.
- Arama sonuçları kategorize edilmeli:
  - 📌 **Projeler**
  - 📝 **Görevler** (Durum rengi, ID ve başlık ile)
  - ⚡ **Hızlı Aksiyonlar / Navigasyon**
- **Klavye Navigasyonu:** Yukarı/Aşağı ok tuşlarıyla sonuçlar arasında gezinme, `Enter` ile seçilen öğeye gitme.

## 4. Testler
`src/lib/__tests__/search-logic.test.ts` dosyasını oluştur. En az 12 test yaz:
- Query temizleme ve normalizasyon
- Fuzzy / substring eşleştirme kuralları
- Görev identifier ayrıştırma (Örn. `PRJ-12` sorgusunu algılama)
- Klavye indeks navigasyon mantığı (Listenin başına/sonuna gelindiğinde döngü davranışı)
- Sonuç gruplama ve boş sonuç durumları

## Kabul Kriterleri
- Herhangi bir sayfadayken `Ctrl+K` / `Cmd+K` ile palet açılmalı.
- Görev seçildiğinde ilgili proje panosuna gidip modalı açmalı veya yönlendirmeli.
- Klavye ile tam kontrol sağlanabilmeli.
- npm test, npx tsc --noEmit ve npm run build hatasız tamamlanmalı.
- Otomatik commit: `git commit -m "feat: (Prompt T) add global search, command palette (Cmd+K) and tests"`
```

---

## PROMPT U: Dashboard Yenileme & Analytics

```text
[YUKARIDAKİ ORTAK TALİMAT BLOĞUNU BURAYA EKLEYİN]

# FAZ 3 PROMPT U: Dashboard Yenileme & Analytics

Pulse ana dashboard (`/`) ekranını sadece proje listesi gösteren sade halinden, kişiselleştirilmiş ve zengin bir proje yönetimi merkezine dönüştür.

## Ön İnceleme
- `src/app/(main)/page.tsx`
- `src/components/projects/project-list.tsx`
- `Activity` modeli ve `TaskAssignee` ilişkisi

## 1. Kişisel Özet Kartları (Stats Overview)
Dashboard'un üst bölümüne 4 adet metrik kartı ekle:
1. **Toplam Aktif Projeler** (Kullanıcının üyesi olduğu)
2. **Bana Atanan Görevler** (Açık durumdaki görev sayısı)
3. **Gecikmiş Görevler** (DueDate geçmiş ve henüz DONE olmayanlar)
4. **Aktif Sprintler** (Üye olunan projelerdeki toplam aktif sprint)

## 2. "Bana Atananlar" (Assigned to Me) Widget'ı
- Kullanıcıya atanmış, henüz tamamlanmamış (`state.group !== "DONE"`) en güncel 5 görevi listele.
- Görev başlığı, öncelik rozeti, son teslim tarihi ve proje adı gösterilsin.
- Tıklandığında doğrudan ilgili görevin panosuna yönlendirsin.

## 3. Son Aktiviteler Akışı (Recent Activity)
- Kullanıcının projelerinde gerçekleşen son 8 aktiviteyi listele (mevcut `Activity` tablosundan).
- `formatActivityMessage` kullanarak Türkçe mesajlar ve göreceli zaman ("5 dakika önce").

## 4. Sprint Metrikleri & Hız Göstergesi (Pure Logic)
- `src/lib/analytics-logic.ts` dosyasını oluştur.
- Saf fonksiyonlar:
  - `calculateSprintBurndown(totalTasks, completedTasksByDate)`
  - `calculateProjectVelocity(completedSprints)`
  - `calculateCompletionRate(tasks)`
- Harici grafik kütüphanesi ekleme; Tailwind CSS ile şık, CSS tabanlı progress ve bar göstergeleri oluştur.

## 5. Testler
`src/lib/__tests__/dashboard-analytics.test.ts` dosyasını oluştur. En az 14 test yaz:
- Gecikmiş görev tespiti
- Tamamlanma yüzdesi hesaplamaları (0 görev, tamamlama sınır durumları)
- Velocity ortalaması hesaplama kuralları
- Aktivite zamanı formatlama helper'ları

## Kabul Kriterleri
- Dashboard kullanıcının odaklanması gereken görevleri öne çıkarmalı.
- Sorgular optimize edilmeli.
- npm test, npx tsc --noEmit ve npm run build hatasız tamamlanmalı.
- Otomatik commit: `git commit -m "feat: (Prompt U) revamp dashboard with analytics, stats cards, my tasks and tests"`
```

---

## PROMPT V: Gelişmiş Filtreler & Kayıtlı Görünümler

```text
[YUKARIDAKİ ORTAK TALİMAT BLOĞUNU BURAYA EKLEYİN]

# FAZ 3 PROMPT V: Gelişmiş Filtreler & Kayıtlı Görünümler

Pulse filtreleme altyapısını genişleterek kullanıcıların pano ve liste görünümlerinde çok kriterli filtreler oluşturmasını ve bunları "Kayıtlı Görünümler" (Saved Views) olarak saklamasını sağla.

## Ön İnceleme
- `src/lib/board-filters.ts`
- `src/components/filters/filter-bar.tsx`

## 1. Filtre Kriterlerinin Genişletilmesi
`board-filters.ts` dosyasını genişleterek şu filtreleri destekle:
- **State Grubu Filtresi:** `group` (`TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED`)
- **Tarih Aralığı:** `due` (`overdue` = gecikmişler, `today` = bugün, `this_week` = bu hafta, `no_date` = tarihsiz)
- **Metin Arama:** `q` (başlıkta hızlı arama)
- Mevcut `priority`, `label`, `assignee` filtreleri korunmalı.

## 2. Hızlı Filtre Butonları (Quick Filters)
Filter bar üzerine tek tıklamayla aktifleşen filtre çipleri ekle:
- "Bana Atananlar"
- "Acil Görevler"
- "Gecikmişler"
- "Tamamlanmamışlar"

## 3. Kayıtlı Görünümler (Saved Views)
- Kullanıcının uyguladığı filtreleri kaydedebilmesini sağla (`localStorage` tabanlı `useSavedViews` hook'u).
- Hazır varsayılan görünümler: "Varsayılan", "Benim Görevlerim", "Acil Durumlar".
- Kullanıcı filtre setini adlandırıp kaydedebilmeli ve tek tıkla URL'ye uygulayabilmeli.

## 4. Testler
`src/lib/__tests__/advanced-filters.test.ts` dosyasını oluştur. En az 12 test yaz:
- Tarih aralığı predicate fonksiyonları (Overdue, today, this_week)
- State grubu filtresinin Prisma where clause üretimi
- Saved view URL query string serialization ve parsing testi
- Birden çok filtrenin birleşim testleri

## Kabul Kriterleri
- Filtreler Board ve List görünümünde akıcı çalışmalı.
- Kayıtlı görünümler sayfayı yenileyince korunmalı.
- npm test, npx tsc --noEmit ve npm run build hatasız tamamlanmalı.
- Otomatik commit: `git commit -m "feat: (Prompt V) add advanced filters, quick filter chips, saved views and tests"`
```

---

## PROMPT W: Task Relations (Bağımlılıklar)

```text
[YUKARIDAKİ ORTAK TALİMAT BLOĞUNU BURAYA EKLEYİN]

# FAZ 3 PROMPT W: Task Relations (İlişkiler & Bağımlılıklar)

Pulse'a görevler arası bağımlılık ve ilişki kurma yeteneği (Blocks / Blocked by / Relates to / Duplicates) ekle.

## 1. Prisma Modeli & Migration
`prisma/schema.prisma` içine ekle:
```prisma
enum RelationType {
  BLOCKS
  RELATES_TO
  DUPLICATES
}

model TaskRelation {
  id           String       @id @default(cuid())
  sourceTaskId String
  targetTaskId String
  type         RelationType
  createdAt    DateTime     @default(now())

  sourceTask   Task         @relation("SourceRelations", fields: [sourceTaskId], references: [id], onDelete: Cascade)
  targetTask   Task         @relation("TargetRelations", fields: [targetTaskId], references: [id], onDelete: Cascade)

  @@unique([sourceTaskId, targetTaskId, type])
  @@index([sourceTaskId])
  @@index([targetTaskId])
}
```
`Task` modeline karşılık gelen `sourceRelations` ve `targetRelations` alanlarını ekle.
Migration oluştur: `npx prisma migrate dev --name add_task_relations`.

## 2. Server Actions: `src/actions/relation.ts`
- `addTaskRelation(sourceTaskId: string, targetTaskId: string, type: RelationType)`
- `removeTaskRelation(relationId: string)`
- **Güvenlik ve Kurallar:**
  - Bir görev kendisiyle ilişkilendirilemez ($A \to A$).
  - Görevlerin aynı projede olduğu doğrulanmalı.
  - **Döngüsel Bağımlılık Koruması (Cycle Check):** $A \to B$ ve $B \to C$ engelliyorsa, $C \to A$ engellemesi reddedilmeli (`src/lib/relation-logic.ts` içinde DFS algoritması).
- `$transaction` içinde çalışmalı ve Activity kaydedilmeli.

## 3. Task Detail Arayüzü Entegrasyonu
- `TaskDetailModal` içine "İlişkiler" (Relations) bölümü ekle:
  - "Engelliyor", "Tarafından Engelleniyor", "İlişkili", "Yinelenen".
  - İlişkili görev rozetleri tıklanabilir olmalı.
  - Hızlı ilişki ekleme arayüzü.

## 4. Testler
`src/lib/__tests__/task-relations.test.ts` dosyasını oluştur. En az 16 test yaz:
- Kendine ilişki ekleme koruması
- Doğrudan döngü koruması ($A \to B \to A$)
- Derin döngü koruması ($A \to B \to C \to A$)
- `RELATES_TO` için döngü serbestliği
- İlişki tersi etiketleme mantığı ("Engelliyor" <-> "Tarafından engelleniyor")

## Kabul Kriterleri
- Görevler arası ilişkiler eklenebilmeli ve silinebilmeli.
- Döngüsel bağımlılıklar sunucu tarafında engellenmeli.
- npm test, npx tsc --noEmit ve npm run build hatasız tamamlanmalı.
- Otomatik commit: `git commit -m "feat: (Prompt W) add task relations, cycle detection, relations UI and tests"`
```

---

## PROMPT X: Kullanıcı Profili & Şifre Değiştirme

```text
[YUKARIDAKİ ORTAK TALİMAT BLOĞUNU BURAYA EKLEYİN]

# FAZ 3 PROMPT X: Kullanıcı Profili & Şifre Değiştirme

Kullanıcının kendi hesap bilgilerini güncelleyebileceği ve mevcut şifresini güvenli bir şekilde değiştirebileceği Profil ekranını ekle.

## Ön İnceleme
- `src/lib/auth.ts` (NextAuth oturum ve bcryptjs)
- `src/components/layout/header.tsx` ve `src/components/layout/sidebar.tsx`

## 1. Route: `/profile`
- Oturum açmış kullanıcılar için `/profile` sayfasını oluştur.
- İki ana sekme/bölüm:
  1. **Profil Bilgileri:** Ad Soyad düzenleme, E-posta (Salt okunur), Hesap oluşturulma tarihi, Avatar renk önizlemesi.
  2. **Güvenlik (Şifre Değiştirme):** Mevcut şifre, Yeni şifre, Yeni şifre tekrarı.

## 2. Server Actions: `src/actions/profile.ts`
- `updateProfile(name: string)`: Ad boş olamaz, trim uygulanır.
- `changePassword(input: ChangePasswordInput)`:
  - Mevcut şifre `bcrypt.compare` ile doğrulanmalıdır.
  - Yeni şifre en az 6 karakter olmalı ve tekrarıyla eşleşmelidir.
  - Yeni şifre eski şifreyle aynı olamaz.
  - Şifre `bcrypt.hash(..., 12)` ile güncellenmelidir.

## 3. Menü Bağlantısı
- Header veya Sidebar profil simgesine tıklandığında `/profile` sayfasına yönlendirme sağla.

## 4. Testler
`src/lib/__tests__/profile-validation.test.ts` dosyasını oluştur. En az 10 test yaz:
- Şifre karmaşıklığı ve uzunluk kuralları
- Şifre eşleşme ve eski şifreyle aynılık kontrolleri
- İsim normalizasyon kuralları

## Kabul Kriterleri
- Şifre güvenli biçimde değiştirilebilmeli.
- Yanlış mevcut şifrede açık Türkçe hata mesajı verilmeli.
- npm test, npx tsc --noEmit ve npm run build hatasız tamamlanmalı.
- Otomatik commit: `git commit -m "feat: (Prompt X) add user profile page, password change with bcrypt and tests"`
```
