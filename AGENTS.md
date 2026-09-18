# Staj PM — Agent Development Guide

## Proje Kimliği
- **Ad:** Staj PM — Kanban-first Proje Yönetim Uygulaması
- **Konum:** `C:\Staj_Project`
- **Versiyon:** v0.2.0 (Faz 1 + Faz 2 tamamlandı)
- **URL:** http://localhost:3000
- **DB:** PostgreSQL 16 (Docker container: `staj-pm-postgres`, port 5432)

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

## Veritabanı Modelleri (Faz 1 + Faz 2 — 12 model)
User, Project, ProjectMember, State, Task, Label, TaskLabel, TaskAssignee, Comment,
Sprint, SprintTask, Activity

Enum'lar (4):
- StateGroup (BACKLOG/TODO/IN_PROGRESS/DONE/CANCELLED)
- Priority (NONE/LOW/MEDIUM/HIGH/URGENT)
- SprintStatus (DRAFT/ACTIVE/COMPLETED)
- ActivityType (15 değer: TASK_CREATED, TASK_TITLE_UPDATED, TASK_DESCRIPTION_UPDATED,
  TASK_STATE_CHANGED, TASK_PRIORITY_CHANGED, TASK_DUE_DATE_CHANGED, TASK_START_DATE_CHANGED,
  TASK_ASSIGNEE_ADDED, TASK_ASSIGNEE_REMOVED, TASK_LABEL_ADDED, TASK_LABEL_REMOVED,
  TASK_SPRINT_ADDED, TASK_SPRINT_REMOVED, COMMENT_ADDED, COMMENT_DELETED)

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
  - settings-validation.test.ts (30)
- Toplam: 136 test, %100 geçiyor

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

## Aktif Görev — Faz 3 (v0.3.0) — Planlama Aşamasında
Faz 3 kapsamı henüz prompt bazında netleştirilmedi. Aday konular:
- E-posta / uygulama içi bildirimler
- OAuth entegrasyonu (Google & GitHub)
- Yapay zekâ destekli görev özeti ve otomasyon

## Her Prompt Sonrası Doğrulama
npm test          # tüm testler geçmeli
npx tsc --noEmit  # TypeScript hatası olmamalı

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
