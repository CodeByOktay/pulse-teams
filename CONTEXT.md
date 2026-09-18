# CONTEXT - Staj PM (v0.1.0 -> Faz 2)
Bu dosyayi yeni bir AI chat'ine yapistir. Agent projeyi aninda kavrar.

## Proje Nedir?
Kanban-first Proje Yonetim Uygulamasi. Staj projesi. Faz 1 tamamlandi, Faz 2 devam ediyor.

## Lokasyon & Calistirma
- Proje: C:\Staj_Project
- DB: PostgreSQL 16 Docker (docker start staj-pm-postgres)
- Sunucu: cd C:\Staj_Project && npm run dev  ->  http://localhost:3000
- Test: npm test (67 test, %100 geciyor)

## Stack
Next.js 16 App Router + TypeScript + Tailwind v4 + Prisma v6 + PostgreSQL 16
NextAuth.js (JWT, CredentialsProvider) + @dnd-kit + Vitest + lucide-react

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

## Kritik Teknikler
- requireMembership(projectId, userId) -> her server action'da yetki kontrolu
- getNextSequenceId(projectId, tx) -> proje bazli artan ID (src/lib/sequence.ts)
- getAvatarColor(name) -> bitwise hash -> 10 renkten biri (src/lib/colors.ts)
- parseBoardFilters(searchParams) -> URL param -> Prisma where (src/lib/board-filters.ts)
- Float siralama: araya ekleme = (ust.sortOrder + alt.sortOrder) / 2
- Tum mutasyonlar revalidatePath() ile sonlanir
- State silinmesi: onDelete: Restrict (gorevler tasınmadan silinemez)

## Faz 2 Siradaki Is (v0.2.0)
J: [TAMAMLANDI ✅] Sprint/Cycle DB semasi + 7 server action + sprint-utils (13 test, 27 toplam)
K: [TAMAMLANDI ✅] Sprint Yonetim Sayfasi + UI + sprint-actions.test.ts (11 test, 38 toplam)
L: [TAMAMLANDI ✅] Liste Gorunumu tablo + ViewSwitcher + list-view-sort.test.ts (15 test)
M: [TAMAMLANDI ✅] Aktivite/Audit Log 15 ActivityType + activity-logger.test.ts (14 test, 67 toplam)
N: Toplu Islemler Bulk Actions + bulk-selection.test.ts (15 test)
O: Markdown Aciklama react-markdown + markdown-utils.test.ts (15 test)
P: Proje Ayarlari State ve Etiket yonetimi + settings-validation.test.ts (20 test)
Hedef: 100+ Vitest testi, npm run build hatasiz

## Her Prompt Sonrasi Dogrulama
npm test
npx tsc --noEmit

## Yeni Chat Baslangic Sablonu
Proje: C:\Staj_Project - Staj PM (Next.js 16 + Prisma + PostgreSQL Kanban uygulamasi)
Faz 1 (v0.1.0) tamamlandi. 14 Vitest testi %100 geciyor.
Simdi Faz 2 Prompt [J/K/L...] uygulayacagiz.
[Ilgili prompt blogunu buraya yapistir]




