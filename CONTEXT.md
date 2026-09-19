# CONTEXT - Pulse (v0.3.0-dev -> Faz 3 devam ediyor)
Bu dosyayi yeni bir AI chat'ine yapistir. Agent projeyi aninda kavrar.

## Proje Nedir?
Kanban-first Proje Yonetim Uygulamasi. Staj projesi. Faz 1 ve Faz 2 tamamlandi, Faz 3 devam ediyor (Prompt S tamamlandi).

## Lokasyon & Calistirma
- Proje: C:\Pulse
- DB: PostgreSQL 16 Docker (docker start pulse-postgres)
- Sunucu: cd C:\Pulse && npm run dev  ->  http://localhost:3000
- Test: npm test (206 test, %100 geciyor)

## Stack
Next.js 16 App Router (Turbopack) + TypeScript + Tailwind v4 + Prisma v6 + PostgreSQL 16
NextAuth.js (JWT, CredentialsProvider) + @dnd-kit + react-markdown + remark-gfm + Vitest + lucide-react

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

## Faz 3 Tamamlanan Ozellikler (v0.3.0-dev)
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
- 206 Vitest testi (%100 basari)

## Faz 3 Bekleyen Promptlar
- **T** [BEKLEYEN] Global Arama & Komut Paleti (Cmd+K)
- **U** [BEKLEYEN] Dashboard Yenileme & Analytics
- **V** [BEKLEYEN] Gelismis Filtreler & Kayitli Gorunumler
- **W** [BEKLEYEN] Task Relations (Blocks/Relates To)
- **X** [BEKLEYEN] Kullanici Profili & Sifre Degistirme

## Kritik Teknikler
- requireMembership(projectId, userId) -> her server action'da yetki kontrolu
- requireAdmin(projectId, userId) -> state action'larinda role==="ADMIN" kontrolu (src/actions/state.ts)
- getNextSequenceId(projectId, tx) -> proje bazli artan ID (src/lib/sequence.ts)
- getAvatarColor(name) -> bitwise hash -> 10 renkten biri (src/lib/colors.ts)
- parseBoardFilters(searchParams) -> URL param -> Prisma where (src/lib/board-filters.ts)
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

## Mevcut Route Haritasi
/                           → Dashboard (proje listesi)
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
backlog-logic.test.ts (23) = 206 toplam

## Her Prompt Sonrasi Dogrulama
npm test
npx tsc --noEmit
npm run build

## Yeni Chat Baslangic Sablonu
Proje: C:\Pulse - Pulse (Next.js 16 + Prisma + PostgreSQL Kanban uygulamasi)
Faz 1 (v0.1.0), Faz 2 (v0.2.0) tamamlandi. Faz 3 devam ediyor (Prompt S tamamlandi).
206 Vitest testi %100 geciyor.
Simdi Faz 3 Prompt [T/U/V...] uygulayacagiz.
[Ilgili prompt blogunu buraya yapistir]
