# Staj PM — Agent Development Guide

## Proje Kimliği
- **Ad:** Staj PM — Kanban-first Proje Yönetim Uygulaması
- **Konum:** `C:\Staj_Project`
- **Versiyon:** v0.1.0 (Faz 1 tamamlandı)
- **URL:** http://localhost:3000
- **DB:** PostgreSQL 16 (Docker container: `staj-pm-postgres`, port 5432)

## Teknoloji Yığını
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Dil:** TypeScript (strict mode)
- **DB ORM:** Prisma v6.19.3 + PostgreSQL 16
- **Auth:** NextAuth.js v4 — CredentialsProvider + JWT + bcryptjs (salt:12)
- **Stil:** Tailwind CSS v4
- **Sürükle-Bırak:** @dnd-kit/core + @dnd-kit/sortable
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

## Veritabanı Modelleri (Faz 1)
User, Project, ProjectMember, State, Task, Label, TaskLabel, TaskAssignee, Comment
Enum'lar: StateGroup (BACKLOG/TODO/IN_PROGRESS/DONE/CANCELLED), Priority (NONE/LOW/MEDIUM/HIGH/URGENT)

## Kritik Mimari Kararlar
- Prisma singleton: src/lib/prisma.ts — globalThis pattern (hot-reload güvenli)
- Server Actions: src/actions/ altında — "use server" directive ile
- Üyelik doğrulama: Her action'da requireMembership(projectId, userId) çağrılır
- Float sıralama: sortOrder Float — araya ekleme: (üst + alt) / 2
- Sequence ID: getNextSequenceId() — proje bazlı artan tamsayı (PRJ-1, PRJ-2)
- Avatar rengi: getAvatarColor(name) — bitwise hash → 10 renk palet
- Filtreleme: URL search params tabanlı, server-side (Prisma where clause)
- Optimistic updates: Kanban sürükle-bırakta — hata halinde rollback
- State silinmesi: onDelete: Restrict — görevler başka state'e taşınmadan silinemez

## Test Konvansiyonu
- Konum: src/lib/__tests__/*.test.ts
- Framework: Vitest — import { describe, it, expect, vi } from "vitest"
- Kural: Server action'lar doğrudan test edilmez → business logic saf fonksiyona çıkarılır
- Mock: vi.fn().mockResolvedValue() ile Prisma client mock'lanır
- Mevcut testler: sequence.test.ts (2), sort-order.test.ts (4), colors.test.ts (3), board-filters.test.ts (5)
- Toplam: 14 test, %100 geçiyor

## Kod Stili
- Import alias: @/* → src/*
- Bileşenler: PascalCase, Server Component default (gerekirse "use client")
- Actions: camelCase, "use server" directive zorunlu
- Hata: throw new Error("Türkçe mesaj")
- revalidatePath: Her mutasyondan sonra zorunlu

## Aktif Görev — Faz 2 (v0.2.0) — Prompt Sırası
J: Sprint/Cycle Şeması + sprint-utils.test.ts
K: Sprint Yönetim Sayfası + sprint-actions.test.ts
L: Liste Görünümü + list-view-sort.test.ts
M: Aktivite/Audit Log + activity-logger.test.ts
N: Toplu İşlemler + bulk-selection.test.ts
O: Markdown Desteği + markdown-utils.test.ts
P: Proje Ayarları + settings-validation.test.ts
Hedef: 100+ Vitest testi, npm run build hatasız

## Her Prompt Sonrası Doğrulama
npm test          # tüm testler geçmeli
npx tsc --noEmit  # TypeScript hatası olmamalı

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
