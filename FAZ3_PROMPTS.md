# Pulse — Faz 3 Claude Uygulama Promptları

Bu dosya, Pulse v0.3.0-dev aşamasında Faz 3 özelliklerinin sırayla Claude'a yazdırılması için hazırlanmış eksiksiz ve güncel prompt paketidir.

---

## Faz 3 İlerleme ve Durum Tablosu

| Prompt | Özellik | Kapsam | Durum | Commit |
|:---:|:---|:---|:---:|:---:|
| **Q** | **Üye Yönetimi & Davet Sistemi** | `ProjectInvite` modeli, 5 action, `/invite/[token]`, MembersManager, 28 test | **TAMAMLANDI** | `2168f24` |
| **R** | **Task Detail Premium UX** | Linear tarzı inline seçiciler, breadcrumb, copy link, sprint gösterimi, 19 test | **TAMAMLANDI** | `d29122b` |
| **S** | **Backlog & Sprint Entegrasyonu** | `/projects/[id]/backlog`, sprint progress bar, görev taşıma, 23 test | **TAMAMLANDI** | `02271ea` |
| **T** | **Global Arama & Komut Paleti** | `Cmd+K` / `Ctrl+K`, fuzzy arama, hızlı aksiyonlar, 24 test | **TAMAMLANDI** | `872fd27` |
| **U** | **Dashboard Yenileme & Analytics** | Stats overview, Bana Atananlar, aktivite akışı, velocity, 25 test | **TAMAMLANDI** | `82dfddf` |
| **V** | **Gelişmiş Filtreler & Kayıtlı Görünümler**| Çoklu filtreler, StateGroup/Tarih aralığı, Kayıtlı Görünümler (Saved Views), 36 test | **TAMAMLANDI** | `30d48cf` |
| **W** | **Task Relations (Bağımlılıklar)** | `TaskRelation` modeli, Blocks/Relates to, döngü engelleme (iteratif DFS), 16+ test | **SIRADAKİ** | - |
| **X** | **Kullanıcı Profili & Şifre Değiştirme** | `/profile`, profil güncelleme, bcrypt ile şifre değiştirme, 10+ test | Bekliyor | - |

---

## HER PROMPTUN BAŞINA EKLENECEK ORTAK TALİMAT BLOĞU

> **Claude'a Gönderim Kuralı:** Aşağıdaki promptu Claude'a gönderirken bu ortak talimat bloğunu eksiksiz dahil edin.

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

## PROMPT W: Task Relations (İlişkiler & Bağımlılıklar) — [NİHAİ & NETLEŞTİRİLMİŞ]

```text
[YUKARIDAKİ ORTAK TALİMAT BLOĞUNU BURAYA DAHİL EDİN]

# FAZ 3 PROMPT W: Task Relations (İlişkiler & Bağımlılıklar)

Pulse'a görevler arası bağımlılık ve ilişki kurma yeteneği (Blocks / Blocked by / Relates to / Duplicates) ekle.

Bu prompt hem veritabanı şeması genişletmesi (migration), hem graf döngü tespiti (pure algorithm), hem de Task Detail UI geliştirmesini kapsar.

## 1. Prisma Modeli ve Migration

### 1.1 Schema Değişiklikleri (`prisma/schema.prisma`)
1. `RelationType` enum'ını ekle:
```prisma
enum RelationType {
  BLOCKS
  RELATES_TO
  DUPLICATES
}
```

2. `TaskRelation` modelini ekle:
```prisma
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

3. `Task` modeline karşılık gelen ters ilişkileri ekle:
```prisma
  sourceRelations TaskRelation[] @relation("SourceRelations")
  targetRelations TaskRelation[] @relation("TargetRelations")
```

4. `ActivityType` enum'ına 2 yeni tip ekle:
```prisma
  TASK_RELATION_ADDED
  TASK_RELATION_REMOVED
```

### 1.2 Migration Güvenliği
- `prisma migrate reset`, `db push --force-reset` veya veri silen HİÇBİR komutu çalıştırma!
- PostgreSQL container'ının çalıştığını doğrula (`docker ps`).
- Migration oluştur: `npx prisma migrate dev --name add_task_relations`
- Üretilen SQL dosyasını kontrol et; yalnızca `RelationType` enum'ı, `TaskRelation` tablosu, indeksler ve `ActivityType` enum güncellemesini içermelidir.

## 2. İlişki Semantiği ve İş Mantığı Kuralları (`src/lib/relation-logic.ts`)

### 2.1 Tek Yönlü Kayıt ve Çift Perspektif
- Her ilişki veritabanında TEK yönlü ve TEK bir `TaskRelation` kaydı olarak saklanır.
- "Tarafından engelleniyor" ayrı bir enum DEĞİLDİR; `BLOCKS` kaydının hedef (`targetTask`) tarafındaki görünümüdür. Veritabanına ters kayıt ASLA yazılmaz.
- Perspektif Etiketleri (Kaynak perspektifi / Hedef perspektifi):
  - `BLOCKS`: "Engelliyor" / "Tarafından engelleniyor"
  - `RELATES_TO`: "İlişkili" / "İlişkili"
  - `DUPLICATES`: "Şunun kopyası" / "Kopyaları"
- `getRelationLabel(type: RelationType, direction: "source" | "target"): string` saf fonksiyonunu yaz ve test et.

### 2.2 Tek Çift Kuralı (Pair-level Uniqueness)
- Aynı iki görev arasında, yönden bağımsız olarak yalnızca BİR ilişki bulunabilir.
- A ile B arasında herhangi bir ilişki varsa (A → B veya B → A), yeni bir ilişki eklenemez.
- Kontrol uygulama katmanında transaction içinde yapılmalıdır:
  `hasExistingRelation(existingRelations, taskId1, taskId2): boolean`

### 2.3 Döngü Kontrolü (Cycle Check — İteratif DFS)
- Döngü kontrolü YALNIZCA `BLOCKS` ilişkileri için geçerlidir (`RELATES_TO` ve `DUPLICATES` döngü oluşturabilir).
- Yeni bir `X BLOCKS Y` (X engeller Y) kenarı eklenirken, Y düğümünden başlayarak `BLOCKS` kenarları takip edildiğinde X düğümüne ulaşılabiliyorsa bir döngü oluşur ($Y \to \dots \to X \to Y$) ve işlem reddedilmelidir.
- **İteratif DFS Zorunluluğu:** `wouldCreateBlockCycle(edges: Array<{ sourceTaskId: string; targetTaskId: string }>, newSourceId: string, newTargetId: string): boolean`
  - Rekürsiyon (özyineleme) KULLANMA. `stack` dizisi ve `visited` Set'i ile döngüsüz iterasyon yap.
  - Mevcut veride önceden oluşmuş döngü olsa dahi `visited` seti sayesinde sonsuz döngüye girmemelidir.
  - 1000+ düğümlü derin zincirlerde Call Stack Overflow vermemelidir.

### 2.4 Görev İlişkilerini Gruplama
- `groupRelationsForTask(taskId: string, sourceRelations: any[], targetRelations: any[]): GroupedRelations`
  - `blocks`: Görevin kaynak olduğu BLOCKS kayıtları (Engelliyor)
  - `blockedBy`: Görevin hedef olduğu BLOCKS kayıtları (Tarafından engelleniyor)
  - `relatesTo`: Her iki yöndeki RELATES_TO kayıtları
  - `duplicates`: Kaynak ise "Şunun kopyası", hedef ise "Kopyaları"

## 3. Server Actions (`src/actions/relation.ts`)

### 3.1 `addTaskRelation(sourceTaskId: string, targetTaskId: string, type: RelationType)`
1. **Oturum:** Kullanıcı giriş yapmış olmalı.
2. **Kendine İlişki Engeli:** `sourceTaskId === targetTaskId` ise `Error("Bir görev kendisiyle ilişkilendirilemez.")`.
3. **Veri & Proje Doğrulaması:** İki görev veritabanından okunur (`id`, `projectId`, `identifier`). Biri dahi yoksa `Error("Görev bulunamadı.")`.
4. `sourceTask.projectId !== targetTask.projectId` ise `Error("Görevler aynı projede olmalıdır.")`.
5. **Yetki:** `requireMembership(sourceTask.projectId, session.user.id)` çağrılır (projectId istemciden ASLA alınmaz).
6. **Mevcut İlişki Kontrolü:** İki görev arasında (yönden bağımsız) mevcut bir kayıt varsa `Error("Bu iki görev arasında zaten bir ilişki var.")`.
7. **Döngü Denetimi (BLOCKS ise):** Projedeki tüm `BLOCKS` ilişkileri çekilir, `wouldCreateBlockCycle` çalıştırılır. Döngü varsa `Error("Bu ilişki döngüsel bağımlılık oluşturur.")`.
8. **Transaction:**
   - `prisma.taskRelation.create(...)`
   - `logActivity(tx, { type: "TASK_RELATION_ADDED", taskId: sourceTaskId, actorId, metadata: { targetIdentifier: targetTask.project.identifier + "-" + targetTask.sequenceId, type } })`
9. `revalidatePath` ile pano ve liste sayfalarını yenile.

### 3.2 `removeTaskRelation(relationId: string)`
1. İlişkiyi `sourceTask` bilgisiyle birlikte oku. İlişki yoksa `Error("İlişki bulunamadı.")`.
2. `requireMembership(relation.sourceTask.projectId, session.user.id)` doğrula.
3. Transaction içinde sil ve `TASK_RELATION_REMOVED` aktivite kaydı düş.
4. `revalidatePath` çağır.

### 3.3 `searchTasksForRelation(projectId: string, currentTaskId: string, query: string)`
- Hızlı ekleme popover'ında hedef görev seçimi için:
- Kullanıcı üyesi olduğu projede arama yapabilmeli (`requireMembership`).
- Query boş ise en güncel 10 görevi getir; query varsa başlıkta (`contains, insensitive`) veya identifier'da ara.
- `currentTaskId` ve halihazırda bu görevle ilişkisi bulunan görevler sonuçlardan hariç tutulmalıdır (`id: { notIn: excludeIds }`).

## 4. Activity Logger Entegrasyonu (`src/lib/activity-logger.ts`)
`formatActivityMessage` fonksiyonuna yeni tipleri ekle:
- `TASK_RELATION_ADDED`: `${actor} göreve '${metadataString(activity, "targetIdentifier")}' ile ilişki ekledi.`
- `TASK_RELATION_REMOVED`: `${actor} görevin '${metadataString(activity, "targetIdentifier")}' ile olan ilişkisini kaldırdı.`
- Mevcut testlerin (`activity-logger.test.ts`) bozulmadığından emin ol.

## 5. Task Detail Arayüzü (`src/components/task-detail/`)

### 5.1 `getTaskDetail` Güncellemesi (`src/actions/task.ts`)
`getTaskDetail` sorgusuna ilişkileri dahil et:
```prisma
sourceRelations: {
  include: {
    targetTask: { select: { id: true, sequenceId: true, title: true, state: { select: { name: true, color: true } }, project: { select: { identifier: true } } } }
  }
},
targetRelations: {
  include: {
    sourceTask: { select: { id: true, sequenceId: true, title: true, state: { select: { name: true, color: true } }, project: { select: { identifier: true } } } }
  }
}
```

### 5.2 `TaskRelations` Bileşeni (`src/components/task-detail/task-relations.tsx`)
- Kompakt, 4 bölümlü akordeon/grup görünümü:
  - ⛔ **Engelliyor** (Blocks)
  - ⏳ **Tarafından engelleniyor** (Blocked by)
  - 🔗 **İlişkili** (Relates to)
  - 📑 **Yinelenen / Kopyası** (Duplicates)
- İlişkili her görev satırında: `PRJ-12` identifier rozeti, durum rengi, başlık ve hover olunca beliren silme (X) butonu.
- İlişkili göreve tıklandığında modal o göreve geçmeli veya URL `?task=[id]` güncellenmelidir.
- **"İlişki Ekle" Popover:**
  - Tip seçici dropdown (Engelliyor / İlişkili / Kopyası)
  - Aday görev arama kutusu (`searchTasksForRelation` ile debounced arama)
  - Tıklanan adayı anında ilişkilendirme.
- İlişki silinirken küçük bir onay veya anında optimistic silme.

### 5.3 Kapsam Dışı (Out of Scope)
- İlişkiye göre görev durum geçişlerini bloklama (kanban dnd kısıtı) BU PROMPTUN KAPSAMINDA DEĞİLDİR.
- Board kartları üzerine bağımlılık rozeti ekleme kapsam dışıdır.

## 6. Testler (`src/lib/__tests__/task-relations.test.ts`)

En az 16 adet Vitest testi yaz:
1. `getRelationLabel`: 3 tipin hem kaynak hem hedef perspektifindeki etiketleri (6 kontrol).
2. Kendine ilişki ekleme kontrolü (`sourceId === targetId`).
3. Doğrudan döngü kontrolü: A → B varken B → A eklenemez.
4. Zincirleme döngü kontrolü: A → B ve B → C varken C → A eklenemez.
5. Elmas graf testi: A → B, A → C, B → D, C → D varken D → A engellenmeli, fakat B → C serbest olmalıdır.
6. Bağlantısız graflar: E → F varken bağımsız A → B döngü üretmez.
7. `RELATES_TO` ve `DUPLICATES` tiplerinin döngü kontrolüne takılmaması (serbest olması).
8. `hasExistingRelation`: A-B ilişkiliyken ters yönde veya farklı tipte mükerrerliğin tespiti.
9. İteratif DFS: Mevcut veride döngü olsa bile sonsuz döngüye girmeme güvencesi.
10. Derin zincir (1000 düğüm) stack overflow koruması.
11. `groupRelationsForTask`: Karışık kaynak/hedef ilişkilerinin 4 gruba doğru ayrıştırılması.

## Kabul Kriterleri
- Veritabanı migration'ı veri kaybı olmadan uygulanmalı.
- Görev detayından ilişkiler eklenebilmeli, görüntülenebilmeli ve silinebilmeli.
- Döngüsel BLOCKS bağımlılıkları sunucu tarafında kesinlikle engellenmeli.
- Mevcut 291 test bozulmamalı, yeni testlerle birlikte tüm testler %100 geçmeli.
- `npx tsc --noEmit` ve `npm run build` hatasız tamamlanmalı.
- Otomatik commit: `git commit -m "feat: (Prompt W) add task relations, cycle detection, relations UI and tests"`
```

---

## PROMPT X: Kullanıcı Profili & Şifre Değiştirme

```text
[YUKARIDAKİ ORTAK TALİMAT BLOĞUNU BURAYA DAHİL EDİN]

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
