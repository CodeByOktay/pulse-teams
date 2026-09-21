# CONTEXT - Pulse Project Manager (v0.3.0 -> Faz 3 tamamlandi)
Bu dosyayi yeni bir AI chat'ine yapistir. Agent projeyi aninda kavrar.

## Proje Nedir?
Pulse Project Manager. Modern, tam tesekkullu Kanban ve Sprint tabanli proje yonetim platformu. Faz 1, Faz 2 ve Faz 3 tamamlandi (son adim: Faz 3.07).

## Lokasyon & Calistirma
- Proje: C:\Pulse
- DB: PostgreSQL 16 Docker (docker start pulse-postgres)
- Sunucu: cd C:\Pulse && npm run dev  ->  http://localhost:3000
- Test: npm test (331 test, %100 geciyor)

## Stack
Next.js 16 App Router (Turbopack) + TypeScript + Tailwind v4 + Prisma v6 + PostgreSQL 16
NextAuth.js (JWT, CredentialsProvider) + @dnd-kit + react-markdown + remark-gfm + Vitest + lucide-react

Kimlik dogrulama kapsami: yalnizca CredentialsProvider (e-posta/sifre + bcrypt salt:12).
Harici kimlik saglayici entegrasyonu proje kapsami disindadir, yol haritasinda yer almaz.

## Faz 1 Tamamlanan Ozellikler (v0.1.0)
- E-posta/sifre kimlik dogrulama (NextAuth + bcryptjs salt:12)
- Proje CRUD + Dashboard + Sidebar (slate-900 koyu tema)
- Gorev CRUD (PRJ-1 sequence ID, float sortOrder sıralaması)
- Etiketler ve Gorevliler (M2M, deterministik avatar rengi bitwise hash)
- Kanban Panosu (@dnd-kit, sutun ici/arasi surukle-birak, Optimistic Updates + rollback)
- Gorev Detay Slide-over Paneli (720px, inline duzenleme, yorumlar, yetki kontrolu)
- URL tabanli Filtreler (oncelik, etiket, gorevli) + Siralama
- 14 Vitest testi (%100 basari)
- git tag v0.1.0

## Faz 2 Tamamlanan Ozellikler (v0.2.0)
- **Sprint/Cycle:** DRAFT->ACTIVE->COMPLETED akisi, tek aktif sprint kisiti, sprint sayfasi (/projects/[id]/sprints), SprintTaskPicker, tamamlanmamis gorev uyarili complete dialogu
- **Liste Gorunumu:** /projects/[id]/list, sıralanabilir sutun basliklari (title/priority/dueDate/createdAt/stateOrder), state'e gore collapsible gruplama, ViewSwitcher (Board <-> Liste), FilterBar yeniden kullanimi
- **Aktivite/Audit Log:** 15 ActivityType (TASK_CREATED, TASK_STATE_CHANGED, TASK_ASSIGNEE_ADDED, COMMENT_ADDED, vb.), her mutasyon prisma.$transaction icinde loglanir, formatActivityMessage Turkce mesaj uretir, TaskDetailModal'da Aktivite/Yorumlar sekmeleri
- **Toplu Islemler:** Liste gorunumunde checkbox secimi + "tumunu sec" (indeterminate destekli), BulkActionBar (durum/oncelik/sprint toplu degistirme, toplu silme + ConfirmDialog), bulkUpdateTasks/bulkDeleteTasks server action'lari (limit: guncelleme 100, silme 50)
- **Markdown Destegi:** MarkdownEditor (Yaz/Onizle sekmeleri, auto-resize textarea, Tab->2 bosluk, B/I/kod/liste/link toolbar), MarkdownRenderer (react-markdown + remark-gfm), Kanban kartinda stripMarkdown+truncateMarkdown ile duz metin onizleme
- **Proje Ayarlari:** /projects/[id]/settings (sadece ADMIN rolu), StatesManager (surukle-birak siralama, renk secici, StateGroup badge, silme kisitlari), LabelsManager (kullanim sayisi, inline duzenleme), ColorPicker (hex <-> color input senkron)
- 136 Vitest testi (%100 basari), npm run build hatasiz

## Faz 3 Tamamlanan Ozellikler (v0.3.0)
- **[Q] Uye Yonetimi & Proje Davet Sistemi:**
  - ProjectInvite modeli (token, email, role, InviteStatus enum: PENDING/ACCEPTED/EXPIRED, expiresAt 7 gun)
  - 5 server action (src/actions/member.ts): inviteMember, acceptInvite, removeMember, changeMemberRole, cancelInvite
  - /invite/[token] sayfasi: token gecerlilik, e-posta esleme, giris durumu — her senaryo icin ozel UI
  - MembersManager bileseni: uyeler tablosu, rol degistirme, uye cikartma, bekleyen davetler, davet linki kopyalama
  - Settings -> Uyeler sekmesi (SettingsTabs'a 3. sekme eklendi)
  - member-management.test.ts (28 test)
- **[R] Task Detail Premium UX:**
  - InlineSelectPopover ortak bilesen + StatusPicker/PriorityPicker (klavye navigasyonu, ayni deger
    tekrar secilirse mutation atlanir, optimistic update + rollback)
  - TaskProperties kompakt grid duzeni, Turkce etiketler, bos deger placeholder'lari (Atanmamis,
    Etiket yok, Tarih Belirtilmedi), Sprint satiri (resolveTaskSprintBadge: ACTIVE > DRAFT > Backlog)
  - DateField (tikla-duzenle tarih secici), CopyLinkButton (window.location.origin tabanli, 2sn
    "Kopyalandi!" rozeti), modal header'a breadcrumb ("Proje Adi / PRJ-12")
  - Board/List gorunumleri ?task= query param'i ile derin baglanti destekliyor (paylasilan link
    dogrudan ilgili gorevi aciyor)
  - getTaskDetail sorgusuna project.name ve sprints iliskisi eklendi
  - task-detail-ux.ts (saf mantik) + task-detail-ux.test.ts (19 test)
- **[S] Backlog Gorunumu & Sprint Entegrasyonu:**
  - /projects/[projectId]/backlog route'u (requireMembership korumali)
  - Backlog tanimi: hicbir ACTIVE/DRAFT sprint'e bagli olmayan gorevler
    (sprints: { none: { sprint: { status: { in: ["ACTIVE","DRAFT"] } } } })
  - moveTaskToSprint / moveTaskToBacklog server action'lari (src/actions/sprint.ts) — $transaction
    icinde calisir, TASK_SPRINT_ADDED/TASK_SPRINT_REMOVED loglar, COMPLETED sprint gecmisini
    asla silmez (getRemovableSprintIds sadece ACTIVE/DRAFT baglantilari secer)
  - Ust bolumde Aktif/Taslak sprint kartlari (SprintProgressCard) + ilerleme cubugu
    (getSprintProgress yeniden kullanildi, 0 gorevli sprintte division-by-zero engellendi)
  - Backlog tablosu: ID, Baslik, Durum, Oncelik, Atanan avatarlari, "Sprint'e Tasi" acilir menusu
    (MoveToSprintMenu), satira tiklaninca TaskDetailModal acilir
  - Sidebar'a Backlog linki (Inbox ikonu), ViewSwitcher'a Backlog secenegi eklendi
  - backlog-logic.ts (saf mantik: isTaskInBacklog, canMoveTaskToSprint, canDeleteSprintTaskLink,
    getRemovableSprintIds, sortActiveDraftSprints) + backlog-logic.test.ts (23 test)
- **[T] Global Arama & Komut Paleti (Cmd+K):**
  - globalSearch(query) server action (src/actions/search.ts) — query >=2 karakter, kullanicinin
    uyesi oldugu projelerdeki gorevleri (baslik substring veya PRJ-12 identifier eslesmesi, max 10)
    ve projeleri (ad/identifier substring, max 5) doner
  - search-logic.ts: normalizeSearchQuery, isQueryValid, parseTaskIdentifier, matchesQuery,
    filterQuickNavCommands, moveActiveIndex (dongusel yukari/asagi), flattenSearchResults/
    countTotalResults/hasNoResults
  - CommandPalette bileseni (src/components/search/command-palette.tsx): Ctrl+K/Cmd+K global
    kisayol, Escape ile kapanma, kategorize sonuclar (Projeler/Gorevler/Hizli Aksiyonlar), ok
    tuslariyla gezinme + Enter ile secim, gorev secildiginde ilgili board'a ?task= ile derin
    baglanti acar
  - Hizli Aksiyon komutlari (Board'a git, Liste'ye git, Backlog'a git, Sprintlere git, Ayarlar'a
    git) yalnizca bir proje sayfasindayken (URL'den activeProjectId cikarilarak) gosterilir
  - Sidebar'a kompakt "Ara... (Ctrl+K)" butonu eklendi
  - search-logic.test.ts (24 test)
- **[U] Dashboard Yenileme & Analytics:**
  - analytics-logic.ts (saf mantik): isTaskOverdue/countOverdueTasks (yalnizca DONE haric tutulur),
    calculateCompletionRate (division-by-zero engellenir), calculateSprintBurndown(totalTasks,
    completedTasksByDate), calculateProjectVelocity (tamamlanan sprintlerin ortalama gorev sayisi,
    1 ondalik basamaga yuvarlanir), formatRelativeTime(date, now?) — task-activity.tsx'teki
    yinelenen fonksiyon kaldirilip bu ortak fonksiyona tasindi
  - Dashboard (/) 4 istatistik karti: Toplam Aktif Projeler, Bana Atanan Gorevler (acik durum),
    Gecikmis Gorevler, Aktif Sprintler — tumu prisma.count ile optimize sorgu (src/components/dashboard/stats-overview.tsx)
  - "Bana Atananlar" widget'i: bana atanan, DONE olmayan en guncel 5 gorev, oncelik rozeti +
    gecikmis tarihte kirmizi vurgu, tiklaninca ilgili board'a ?task= ile yonlendirir
    (src/components/dashboard/my-tasks-widget.tsx)
  - "Son Aktiviteler" akisi: kullanicinin projelerindeki son 8 aktivite, formatActivityMessage +
    formatRelativeTime, tiklaninca ilgili gorevin board'una gider (src/components/dashboard/recent-activity-feed.tsx)
  - "Sprint Hizi" paneli: aktif sprintlerin CSS tabanli ilerleme cubugu (calculateCompletionRate) +
    kalan gorev sayisi (calculateSprintBurndown) + ortalama hiz (calculateProjectVelocity, son 10
    tamamlanmis sprint) — harici grafik kutuphanesi kullanilmadi (src/components/dashboard/sprint-metrics-panel.tsx)
  - dashboard-analytics.test.ts (25 test)
- **[V] Gelismis Filtreler & Kayitli Gorunumler:**
  - board-filters.ts genisletildi: BoardFilters { priorities, labelIds, assigneeIds, groups, due,
    query, sort, order } — group (TODO/IN_PROGRESS/DONE/CANCELLED, BACKLOG haric), due
    (overdue/today/this_week/no_date), q (baslik metin aramasi)
  - resolveDueDateRange/matchesDueFilter: startOfDay/endOfDay/startOfWeek(Pazartesi)/endOfWeek saf
    tarih fonksiyonlari; buildTaskWhereFromFilters tum filtreleri tek Prisma.TaskWhereInput'a
    indirger (board/list sayfalarindaki tekrarli where-clause kodu kaldirildi)
  - serializeBoardFilters/parseBoardFilters: filtre seti <-> URL query string roundtrip
  - QuickFilterChips (src/components/filters/quick-filter-chips.tsx): "Bana Atananlar"/"Acil
    Gorevler"/"Gecikmisler"/"Tamamlanmamislar" tek tikla toggle eden cipler
  - GroupFilter/DueDateFilter/SearchInput (src/components/filters/): durum grubu multi-select,
    tarih araligi select, debounce'li arama input'u
  - saved-views-logic.ts (saf mantik) + use-saved-views.ts (localStorage hook'u,
    pulse:saved-views:{projectId} anahtari): SavedViewsMenu ile gorunum kaydetme/silme/uygulama;
    varsayilan gorunumler (Varsayilan/Benim Gorevlerim/Acil Durumlar) __me__ yer tutucusunu
    resolveSavedViewQuery ile oturum kullanicisina cozer
  - use-board-query.ts'e setParams (toplu param guncelleme) ve applyQueryString (tam query string
    degistirme) eklendi
  - advanced-filters.test.ts (36 test)
- **[W] Task Relations (Iliskiler & Bagimliliklar):**
  - TaskRelation modeli (sourceTaskId/targetTaskId/type, @@unique([sourceTaskId, targetTaskId, type]),
    onDelete: Cascade) + RelationType enum (BLOCKS/RELATES_TO/DUPLICATES) +
    ActivityType'a TASK_RELATION_ADDED/TASK_RELATION_REMOVED eklendi
    (migration: 20260920004710_add_task_relations, yalnizca ekleme yapar, veri kaybi yok)
  - Tek yonlu kayit: bir iliski DB'de TEK kayittir; "Tarafindan engelleniyor" ayri bir tip degil,
    BLOCKS kaydinin hedef tarafindaki gorunumudur (ters kayit asla yazilmaz)
  - relation-logic.ts (saf mantik): getRelationLabel(type, direction), isSelfRelation,
    hasExistingRelation (tek cift kurali - yonden ve tipten bagimsiz), requiresCycleCheck
    (yalnizca BLOCKS), collectBlockEdges, wouldCreateBlockCycle (ITERATIF DFS: stack + visited,
    rekursiyon yok), groupRelationsForTask (blocks/blockedBy/relatesTo/duplicates),
    countGroupedRelations, formatTaskIdentifier
  - 3 server action (src/actions/relation.ts): addTaskRelation (kendine iliski engeli, ayni proje
    zorunlu, projectId dogrulanmis gorev kaydindan alinir, requireMembership, mukerrer iliski ve
    dongu kontrolu, $transaction + logActivity), removeTaskRelation, searchTasksForRelation
    (mevcut iliskili gorevler ve gorevin kendisi id: { notIn } ile haric tutulur, bos sorguda
    en guncel 10 gorev)
  - getTaskDetail sorgusuna sourceRelations/targetRelations include edildi
  - TaskRelations bileseni (src/components/task-detail/task-relations.tsx): 4 grup gorunumu
    (Engelliyor / Tarafindan engelleniyor / Iliskili / Yinelenen-Kopyasi), identifier rozeti +
    durum rengi + hover'da beliren X butonu (optimistic silme, hatada geri alinir),
    "Iliski Ekle" popover'i (tip secici + 250ms debounce'li arama)
  - Iliskili goreve tiklaninca modal o goreve gecer (onNavigateToTask: board/list/backlog
    container'larinda ?task= derin baglantisi da guncellenir)
  - task-relations.test.ts (40 test)
- 331 Vitest testi (%100 basari)

## Kritik Teknikler
- requireMembership(projectId, userId) -> her server action'da yetki kontrolu
- requireAdmin(projectId, userId) -> state action'larinda role==="ADMIN" kontrolu (src/actions/state.ts)
- getNextSequenceId(projectId, tx) -> proje bazli artan ID (src/lib/sequence.ts)
- getAvatarColor(name) -> bitwise hash -> 10 renkten biri (src/lib/colors.ts)
- parseBoardFilters(searchParams) -> URL param -> BoardFilters, buildTaskWhereFromFilters(filters) ->
  Prisma.TaskWhereInput (src/lib/board-filters.ts); serializeBoardFilters ile ters yonde URL query
  string uretilir (Kayitli Gorunumler icin)
- useSavedViews(projectId, filters) -> localStorage tabanli kayitli gorunum hook'u
  (src/lib/use-saved-views.ts), saf mantik src/lib/saved-views-logic.ts'de
- Float siralama: araya ekleme = (ust.sortOrder + alt.sortOrder) / 2
- calculateStateSequences(count) -> [1000, 2000, ...] (src/lib/settings-logic.ts)
- logActivity(tx, data) -> try/catch ile sarili, transaction'i asla fail ettirmez (src/lib/activity-logger.ts)
- sortTasksByField / groupTasksByState -> null dueDate her zaman sonda (src/lib/list-view-sort.ts)
- useBulkSelection<T>(items) -> Set tabanli secim hook'u, pure logic bulk-selection-logic.ts'de
- stripMarkdown / truncateMarkdown -> kelime sinirinda ve dengeli ** / ` ile kesme (src/lib/markdown-utils.ts)
- inviteMember -> ADMIN kontrolu, randomBytes(32).toString("hex") token, 7 gun expiresAt (src/actions/member.ts)
- acceptInvite -> e-posta esleme zorunlu, $transaction ile ProjectMember create + invite update
- Proje sahibi (ownerId) cikartılamaz ve rolu degistirilemez
- Tum mutasyonlar revalidatePath() ile sonlanir
- globalSearch(query) -> parseTaskIdentifier ile "PRJ-12" formatini ayristirir, task title
  substring + identifier eslesmesini OR ile birlestirir, kullanici uyeligi where clause'unda
  filtrelenir (client'tan gelen projectId'ye guvenilmez)
- isTaskOverdue(dueDate, stateGroup, now?) -> yalnizca DONE haric tutulur (CANCELLED de gecikmis
  sayilabilir), formatRelativeTime(date, now?) -> "az once/X dakika once/X saat once/dun/X gun once"
  (src/lib/analytics-logic.ts)
- wouldCreateBlockCycle(edges, newSourceId, newTargetId) -> X BLOCKS Y eklenirken Y'den baslayip
  X'e ulasilabiliyorsa true; stack + visited ile iteratif DFS (src/lib/relation-logic.ts)
- hasExistingRelation(existingRelations, a, b) -> ayni iki gorev arasinda yonden/tipten bagimsiz
  ikinci bir iliski kurulmasini engeller (tek cift kurali)

## Mevcut Route Haritasi
/                           → Dashboard (istatistik kartlari, Bana Atananlar, Son Aktiviteler, Sprint Hizi, proje listesi)
/projects/[id]/board        → Kanban Panosu
/projects/[id]/list         → Liste Gorunumu
/projects/[id]/backlog      → Backlog Gorunumu (YENI - Faz 3 S)
/projects/[id]/sprints      → Sprint Yonetimi
/projects/[id]/settings     → Proje Ayarlari (ADMIN) — Durumlar / Etiketler / Uyeler
/invite/[token]             → Davet Kabul Sayfasi (YENi - Faz 3 Q)
/login                      → Giris Sayfasi
/register                   → Kayit Sayfasi

## Test Dosyasi Bazinda Dagilim
sequence.test.ts (2), sort-order.test.ts (4), colors.test.ts (3), board-filters.test.ts (5),
sprint-utils.test.ts (13), sprint-actions.test.ts (11), list-view-sort.test.ts (15),
activity-logger.test.ts (14), bulk-selection.test.ts (18), markdown-utils.test.ts (21),
settings-validation.test.ts (30), member-management.test.ts (28), task-detail-ux.test.ts (19),
backlog-logic.test.ts (23), search-logic.test.ts (24), dashboard-analytics.test.ts (25),
advanced-filters.test.ts (36), **task-relations.test.ts (40)** = 331 toplam

## Her Faz / Adım Sonrası Doğrulama
npm test
npx tsc --noEmit
npm run build

## Yeni Chat Baslangic Sablonu
Proje: C:\Pulse - Pulse Project Manager (Next.js 16 + Prisma + PostgreSQL proje yonetim platformu)
Faz 1 (v0.1.0), Faz 2 (v0.2.0), Faz 3 (v0.3.0) tamamlandi.
331 Vitest testi %100 geciyor.
Simdi [yeni faz / ozellik] uygulayacagiz.
[Ilgili faz / gorev blogunu buraya yapistir]
