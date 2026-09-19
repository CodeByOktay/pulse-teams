# CONTEXT - Pulse (v0.2.0 -> Faz 3)
Bu dosyayi yeni bir AI chat'ine yapistir. Agent projeyi aninda kavrar.

## Proje Nedir?
Kanban-first Proje Yonetim Uygulamasi. Staj projesi. Faz 1 ve Faz 2 tamamlandi, Faz 3 planlama asamasinda.

## Lokasyon & Calistirma
- Proje: C:\Pulse
- DB: PostgreSQL 16 Docker (docker start pulse-postgres)
- Sunucu: cd C:\Pulse && npm run dev  ->  http://localhost:3000
- Test: npm test (136 test, %100 geciyor)

## Stack
Next.js 16 App Router (Turbopack) + TypeScript + Tailwind v4 + Prisma v6 + PostgreSQL 16
NextAuth.js (JWT, CredentialsProvider) + @dnd-kit + react-markdown + remark-gfm + Vitest + lucide-react

## Faz 1 Tamamlanan Ozellikler (v0.1.0)
- E-posta/sifre kimlik dogrulama (NextAuth + bcryptjs salt:12)
- Proje CRUD + Dashboard + Sidebar (slate-900 koyu tema)
- Gorev CRUD (PRJ-1 sequence ID, float sortOrder siralaması)
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
- Tum mutasyonlar revalidatePath() ile sonlanir
- State silinmesi: onDelete: Restrict (gorevler tasınmadan silinemez) + canDeleteState (son state silinemez)

## Faz 2 Tamamlanan Is Sirasi (v0.2.0)
J: [TAMAMLANDI] Sprint/Cycle DB semasi + 7 server action + sprint-utils.test.ts (13 test, 27 toplam)
K: [TAMAMLANDI] Sprint Yonetim Sayfasi + UI + sprint-actions.test.ts (11 test, 38 toplam)
L: [TAMAMLANDI] Liste Gorunumu tablo + ViewSwitcher + list-view-sort.test.ts (15 test, 53 toplam)
M: [TAMAMLANDI] Aktivite/Audit Log 15 ActivityType + activity-logger.test.ts (14 test, 67 toplam)
N: [TAMAMLANDI] Toplu Islemler Bulk Actions + ConfirmDialog + bulk-selection.test.ts (18 test, 85 toplam)
O: [TAMAMLANDI] Markdown Aciklama react-markdown + markdown-utils.test.ts (21 test, 106 toplam)
P: [TAMAMLANDI] Proje Ayarlari State ve Etiket yonetimi + settings-validation.test.ts (30 test, 136 toplam)
Sonuc: 136 Vitest testi (hedef 100+ asildi), npm run build hatasiz

## Test Dosyasi Bazinda Dagilim
sequence.test.ts (2), sort-order.test.ts (4), colors.test.ts (3), board-filters.test.ts (5),
sprint-utils.test.ts (13), sprint-actions.test.ts (11), list-view-sort.test.ts (15),
activity-logger.test.ts (14), bulk-selection.test.ts (18), markdown-utils.test.ts (21),
settings-validation.test.ts (30) = 136 toplam

## Faz 3 Yol Haritasi (v0.3.0) — Planlama
- E-posta ve uygulama ici bildirimler (gorev atama, yorum, sprint tamamlanma)
- OAuth entegrasyonu (Google & GitHub) — NextAuth provider ekleme
- Yapay Zeka destekli gorev ozeti ve otomasyon onerileri
- (Aday) Dosya/ek eklentisi, gerceklestirilebilir bildirim merkezi, takim bazli raporlama

## Her Prompt Sonrasi Dogrulama
npm test
npx tsc --noEmit
npm run build

## Yeni Chat Baslangic Sablonu
Proje: C:\Pulse - Pulse (Next.js 16 + Prisma + PostgreSQL Kanban uygulamasi)
Faz 1 (v0.1.0) ve Faz 2 (v0.2.0) tamamlandi. 136 Vitest testi %100 geciyor.
Simdi Faz 3 Prompt [Q/R/S...] uygulayacagiz.
[Ilgili prompt blogunu buraya yapistir]
