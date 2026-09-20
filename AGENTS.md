# Pulse — Agent Development Guide

## Proje Kimliği
- **Ad:** Pulse — Kanban-first Proje Yönetim Uygulaması
- **Konum:** `C:\Pulse`
- **Versiyon:** v0.3.0-dev (Faz 3 devam ediyor — Prompt U tamamlandı)
- **URL:** http://localhost:3000
- **DB:** PostgreSQL 16 (Docker container: `pulse-postgres`, port 5432)

## Teknoloji Yığını
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Dil:** TypeScript (strict mode)
- **DB ORM:** Prisma v6.19.3 + PostgreSQL 16
- **Auth:** NextAuth.js v4 — CredentialsProvider + JWT + bcryptjs (salt:12)
- **Stil:** Tailwind CSS v4
- **Sürükle-Bırak:** @dnd-kit/core + @dnd-kit/sortable
- **Markdown:** react-markdown + remark-gfm
- **İkonlar:** lucide-react
- **Test:** Vitest v5 (`npm test` → `vitest run`)

## Komutlar
- `npm run dev` — Geliştirme sunucusu (localhost:3000)
- `npm test` — Tüm Vitest testleri çalıştır
- `npm run build` — Production build
- `npx prisma studio` — DB GUI arayüzü
- `npx prisma db push` — Şemayı DB'ye uygula
- `npx prisma migrate dev --name <isim>` — Migration oluştur
- `npx prisma generate` — Client yeniden üret
- `npx tsc --noEmit` — TypeScript tip kontrolü

## Veritabanı Modelleri (Faz 1 + Faz 2 + Faz 3-Q/W — 14 model)
User, Project, ProjectMember, State, Task, Label, TaskLabel, TaskAssignee, Comment,
Sprint, SprintTask, Activity, ProjectInvite, **TaskRelation**

Enum'lar (6):
- StateGroup (BACKLOG/TODO/IN_PROGRESS/DONE/CANCELLED)
- Priority (NONE/LOW/MEDIUM/HIGH/URGENT)
- SprintStatus (DRAFT/ACTIVE/COMPLETED)
- ActivityType (17 değer: TASK_CREATED, TASK_TITLE_UPDATED, TASK_DESCRIPTION_UPDATED,
  TASK_STATE_CHANGED, TASK_PRIORITY_CHANGED, TASK_DUE_DATE_CHANGED, TASK_START_DATE_CHANGED,
  TASK_ASSIGNEE_ADDED, TASK_ASSIGNEE_REMOVED, TASK_LABEL_ADDED, TASK_LABEL_REMOVED,
  TASK_SPRINT_ADDED, TASK_SPRINT_REMOVED, COMMENT_ADDED, COMMENT_DELETED,
  **TASK_RELATION_ADDED, TASK_RELATION_REMOVED**)
- InviteStatus (PENDING/ACCEPTED/EXPIRED)
- **RelationType** (BLOCKS/RELATES_TO/DUPLICATES)

## Kritik Mimari Kararlar
- Prisma singleton: src/lib/prisma.ts — globalThis pattern (hot-reload güvenli)
- Server Actions: src/actions/ altında — "use server" directive ile
- Üyelik doğrulama: Her action'da requireMembership(projectId, userId) çağrılır
- Rol doğrulama: State (ayarlar) action'larında requireAdmin(projectId, userId) — role==="ADMIN"
- Float sıralama: sortOrder / State.sequence Float — araya ekleme: (üst + alt) / 2
- Sequence ID: getNextSequenceId() — proje bazlı artan tamsayı (PRJ-1, PRJ-2)
- Avatar rengi: getAvatarColor(name) — bitwise hash → 10 renk palet
- Filtreleme: URL search params tabanlı, server-side (Prisma where clause)
- Optimistic updates: Kanban sürükle-bırakta — hata halinde rollback
- State silinmesi: onDelete: Restrict — görevler başka state'e taşınmadan silinemez;
  canDeleteState() ile son state de silinemez
- Aktivite logu: logActivity(tx, data) — her zaman ilgili prisma.$transaction içinde çağrılır,
  kendi try/catch'i ile sarılıdır, ana işlemi asla başarısız yapmaz
- Sprint kısıtı: projede aynı anda yalnızca bir ACTIVE sprint olabilir (canStartSprint)
- Bulk action limitleri: bulkUpdateTasks ≤100 görev, bulkDeleteTasks ≤50 görev,
  tüm taskId'lerin aynı projeye ait olduğu her zaman sunucuda doğrulanır
- Markdown güvenli kesme: truncateMarkdown kelime sınırında keser ve dengesiz ** / ` bırakmaz
- Davet sistemi: inviteMember — ADMIN kontrolü, token (32 byte hex, 7 gün geçerli), PENDING/ACCEPTED/EXPIRED
  e-posta eşleşme zorunlu (acceptInvite), proje sahibi çıkartılamaz/rolü değiştirilemez
- Task Detail inline seçiciler: StatusPicker/PriorityPicker InlineSelectPopover üzerine kurulu,
  optimistic update + resolveOptimisticState ile rollback, shouldUpdateState/shouldUpdatePriority
  ile aynı değer tekrar seçilirse mutation atlanır
- Sprint rozetü: resolveTaskSprintBadge — ACTIVE > DRAFT > Backlog önceliğiyle tek rozet seçer
- Görev paylaşım linki: buildTaskShareUrl(window.location.origin, pathname, taskId) — board/list
  görünümleri ?task= query param'ını okuyup ilgili görevi otomatik açar
- Backlog: isTaskInBacklog — görev hiçbir ACTIVE/DRAFT sprint'e bağlı değilse backlog'dadır
  (COMPLETED sprint geçmişi backlog sayılır); moveTaskToSprint/moveTaskToBacklog yalnızca
  ACTIVE/DRAFT SprintTask bağlantılarını siler, COMPLETED geçmişi asla silinmez
  (canDeleteSprintTaskLink/getRemovableSprintIds)
- Global Arama: globalSearch(query) — sorgu ≥2 karakter, kullanıcının üyesi olduğu projelerdeki
  görev (başlık substring veya PRJ-12 identifier eşleşmesi) ve proje (ad/identifier) sonuçlarını
  döner (görev ≤10, proje ≤5); parseTaskIdentifier ile identifier ayrıştırma src/lib/search-logic.ts'de
  saf fonksiyon; CommandPalette (Ctrl+K/Cmd+K) klavye navigasyonu (moveActiveIndex ile döngüsel
  yukarı/aşağı) ve proje bazlı Hızlı Aksiyon komutları (yalnızca /projects/[id]/... sayfasındayken
  gösterilir) içerir
- Dashboard Analytics: src/lib/analytics-logic.ts saf fonksiyonlar — isTaskOverdue/countOverdueTasks
  (yalnızca DONE hariç tutulur, CANCELLED de gecikmiş sayılabilir), calculateCompletionRate
  (0 görevde division-by-zero engellenir), calculateSprintBurndown(totalTasks, completedTasksByDate),
  calculateProjectVelocity (tamamlanan sprintlerin ortalama görev sayısı, 1 ondalık basamağa
  yuvarlanır), formatRelativeTime(date, now?) — task-activity.tsx da aynı fonksiyonu kullanır
  (kod tekrarı kaldırıldı); Dashboard (/) 4 istatistik kartı (aktif proje/bana atanan açık görev/
  gecikmiş görev/aktif sprint — tümü prisma.count ile optimize sorgu), "Bana Atananlar" widget'ı
  (en güncel 5 açık görev), "Son Aktiviteler" akışı (projelerdeki son 8 aktivite,
  formatActivityMessage + formatRelativeTime), "Sprint Hızı" paneli (aktif sprintlerin ilerleme
  çubuğu + ortalama hız) gösterir; harici grafik kütüphanesi kullanılmaz, tamamı Tailwind CSS
  tabanlı
- Gelişmiş Filtreler: BoardFilters { priorities, labelIds, assigneeIds, groups, due, query, sort, order } —
  board-filters.ts; group filtresi 4 değer alır (TODO/IN_PROGRESS/DONE/CANCELLED, BACKLOG hariç),
  due filtresi (overdue/today/this_week/no_date) resolveDueDateRange ile Date sınırlarına çevrilir
  (hafta Pazartesi başlar); buildTaskWhereFromFilters tüm filtreleri tek Prisma.TaskWhereInput'a
  indirger, board/list sayfalarındaki tekrarlı where-clause kodu kaldırıldı; Hızlı Filtre çipleri
  (Bana Atananlar/Acil Görevler/Gecikmişler/Tamamlanmamışlar) tek tıkla toggle eder; Kayıtlı
  Görünümler useSavedViews hook'u ile localStorage'da proje bazlı saklanır
  (pulse:saved-views:{projectId}), serializeBoardFilters/parseBoardFilters roundtrip ile URL query
  string'e dönüşür, "Benim Görevlerim" gibi varsayılan görünümler __me__ yer tutucusunu
  resolveSavedViewQuery ile oturumdaki kullanıcı ID'sine çözer
- Görev İlişkileri: TaskRelation her zaman TEK yönlü TEK kayıttır — "Tarafından engelleniyor"
  ayrı bir tip değil, BLOCKS kaydının hedef tarafındaki görünümüdür (ters kayıt asla yazılmaz);
  getRelationLabel(type, direction) perspektif etiketini verir, groupRelationsForTask kaynak/hedef
  kayıtlarını blocks/blockedBy/relatesTo/duplicates olarak dörde ayırır (src/lib/relation-logic.ts);
  tek çift kuralı: hasExistingRelation ile aynı iki görev arasında yönden ve tipten bağımsız
  yalnızca bir ilişki kurulabilir; döngü kontrolü YALNIZCA BLOCKS için geçerlidir
  (requiresCycleCheck) — wouldCreateBlockCycle stack + visited ile İTERATİF DFS yapar
  (rekürsiyon yok: 1000+ düğümlü zincirde stack overflow olmaz, mevcut veride döngü olsa bile
  visited seti sonsuz döngüyü engeller); addTaskRelation projectId'yi istemciden değil doğrulanmış
  görev kaydından alır, iki görevin aynı projede olmasını şart koşar

## Test Konvansiyonu
- Konum: src/lib/__tests__/*.test.ts
- Framework: Vitest — import { describe, it, expect, vi } from "vitest"
- Kural: Server action'lar doğrudan test edilmez → business logic saf fonksiyona çıkarılır
  (örn. sprint-logic.ts, settings-logic.ts, list-view-sort.ts, bulk-selection-logic.ts,
  markdown-utils.ts, activity-logger.ts'nin formatActivityMessage'ı)
- Mock: vi.fn().mockResolvedValue() ile Prisma client mock'lanır
- Mevcut testler:
  - sequence.test.ts (2), sort-order.test.ts (4), colors.test.ts (3), board-filters.test.ts (5)
  - sprint-utils.test.ts (13), sprint-actions.test.ts (11), list-view-sort.test.ts (15)
  - activity-logger.test.ts (14), bulk-selection.test.ts (18), markdown-utils.test.ts (21)
  - settings-validation.test.ts (30), member-management.test.ts (28), task-detail-ux.test.ts (19)
  - backlog-logic.test.ts (23), search-logic.test.ts (24), dashboard-analytics.test.ts (25)
  - advanced-filters.test.ts (36), **task-relations.test.ts (40)**
- Toplam: **331 test**, %100 geçiyor

## Kod Stili
- Import alias: @/* → src/*
- Bileşenler: PascalCase, Server Component default (gerekirse "use client")
- Actions: camelCase, "use server" directive zorunlu
- Hata: throw new Error("Türkçe mesaj")
- revalidatePath: Her mutasyondan sonra zorunlu

## Tamamlanan Görev — Faz 2 (v0.2.0) — Prompt Sırası
J: [TAMAMLANDI] Sprint/Cycle Şeması + sprint-utils.test.ts (13 test)
K: [TAMAMLANDI] Sprint Yönetim Sayfası + sprint-actions.test.ts (11 test)
L: [TAMAMLANDI] Liste Görünümü + list-view-sort.test.ts (15 test)
M: [TAMAMLANDI] Aktivite/Audit Log + activity-logger.test.ts (14 test)
N: [TAMAMLANDI] Toplu İşlemler + bulk-selection.test.ts (18 test)
O: [TAMAMLANDI] Markdown Desteği + markdown-utils.test.ts (21 test)
P: [TAMAMLANDI] Proje Ayarları + settings-validation.test.ts (30 test)
Sonuç: 136 Vitest testi (hedef 100+ aşıldı), npm run build hatasız

## Aktif Görev — Faz 3 (v0.3.0) — Devam Ediyor
Faz 3 odak alanları: UX/UI kalitesi · Proje yönetimi yetenekleri · Jira/Linear deneyimi
OAuth + E-posta bildirimleri → Backlog'a alındı.

### Faz 3 Prompt Durumu
- **Q** [TAMAMLANDI] Üye Yönetimi & Davet Sistemi — ProjectInvite + 5 action + /invite/[token] + 28 test
- **R** [TAMAMLANDI] Task Detail Premium UX — inline durum/öncelik seçiciler, breadcrumb, bağlantı
  kopyalama, sprint rozeti + task-detail-ux.test.ts (19 test)
- **S** [TAMAMLANDI] Backlog Görünümü & Sprint Entegrasyonu — /backlog route, moveTaskToSprint/
  moveTaskToBacklog, sprint ilerleme kartları + backlog-logic.test.ts (23 test)
- **T** [TAMAMLANDI] Global Arama & Komut Paleti (Cmd+K) — globalSearch server action,
  CommandPalette bileşeni (Ctrl+K/Cmd+K, klavye navigasyonu), Sidebar'a arama butonu +
  search-logic.test.ts (24 test)
- **U** [TAMAMLANDI] Dashboard Yenileme & Analytics — 4 istatistik kartı, Bana Atananlar widget'ı,
  Son Aktiviteler akışı, Sprint Hızı paneli, analytics-logic.ts + dashboard-analytics.test.ts (25 test)
- **V** [TAMAMLANDI] Gelişmiş Filtreler & Kayıtlı Görünümler — group/due/q filtreleri,
  buildTaskWhereFromFilters, Hızlı Filtre çipleri, useSavedViews (localStorage) +
  advanced-filters.test.ts (36 test)
- **W** [TAMAMLANDI] Task Relations (Blocks/Relates To) — TaskRelation modeli + RelationType enum,
  relation-logic.ts (iteratif DFS döngü tespiti), addTaskRelation/removeTaskRelation/
  searchTasksForRelation, TaskRelations bileşeni (4 grup + İlişki Ekle popover) +
  task-relations.test.ts (40 test)
- **X** [BEKLEYEN]  Kullanıcı Profili & Şifre Değiştirme

## Her Prompt Sonrası Doğrulama
npm test          # tüm testler geçmeli (şu an: 331 test)
npx tsc --noEmit  # TypeScript hatası olmamalı

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
