# Pulse — Claude Code Spesifikasyonları (docs/spec)

Bu dizin, **Claude Code (Builder & Subagent Orchestrator)** tarafından okunup adım adım uygulanacak teknik spesifikasyonları içerir. 

Kullanıcı, promptları kopyala-yapıştır yapmak yerine Claude Code CLI'a doğrudan ilgili spesifikasyon dosyasını okuma talimatı verir:

```bash
# Örnek Claude Code çalıştırma komutu:
claude "Lütfen docs/spec/v0.6.0-step-6.01.md dosyasını oku ve içindeki tüm gereksinimleri adım adım uygula."
```

---

## 1. Rol Dağılımı ve Çalışma Prensipleri

| Rol | Araç / Kimlik | Görev ve Sorumluluklar |
|---|---|---|
| **Lead Architect & QA Authority** | **Antigravity** | Mimari kararlar (ADR), spesifikasyon hazırlığı, tüm testlerin münhasır yazarı (`src/lib/__tests__/` ve `agent/tests/`), regresyon doğrulaması. |
| **Builder & Subagent Orchestrator** | **Claude Code** | Spesifikasyonları okur, kodları yazar, subagent'ları koordine eder (`postgres-pro`, `backend-developer`, `react-specialist`, `nextjs-developer`, `debugger`). **Asla test dosyalarını değiştirmez.** Testleri çalıştırarak kendi kodunu düzeltir. |

---

## 2. Doğrulama Kuralları (Verification Commandments)

Claude Code bir adımı tamamladığında şu komutların tamamı **SIFIR HATA** ile geçmelidir:

```bash
# 1. Vitest Unit & Integration Testleri (TypeScript)
npx vitest run

# 2. TypeScript Tip Kontrolü
npx -p typescript tsc --noEmit

# 3. Python Agent Testleri (Step 6.01+)
cd agent && pytest
```

> **ÖNEMLİ KURAL:** Claude Code test kodlarını (`src/lib/__tests__/*.ts` ve `agent/tests/*.py`) ASLA düzenleyemez veya silemez. Eğer bir test fail ederse, iş mantığını veya arayüz kodunu düzeltmek zorundadır.

---

## 3. Faz 6 Spesifikasyon Haritası

| Sürüm | Dosya | Adım | Durum | Kapsam |
|---|---|---|---|---|
| `v0.6.0-pre` | [ADR-034](../../docs/wiki/ADR-034-AI%20Agent%20Koordinasyon%20Altyapisi%20ve%20Proaktif%20Agent%20Sistemi) | Step 6.00 | **Tamamlandı** | Mimari kararlar, ADR-034, ai-context snapshot, charter onayı. |
| `v0.6.0` | [`v0.6.0-step-6.01.md`](./v0.6.0-step-6.01.md) | Step 6.01 | **Tamamlandı** | Altyapı: Prisma Schema, DomainEvent Outbox, Clock, Python Container (`pulse-agent`), Docker Compose, Supervisor Agent-000, Internal API (HMAC), AgentSettings UI. (574 test %100 geçiyor). |
| `v0.6.1` | [`v0.6.1-step-6.02.md`](./v0.6.1-step-6.02.md) | Step 6.02 | **Tamamlandı** | Agent-001 (Deadline Takipçisi), oturumdan bağımsız `dispatchDueDateReminders`, Dashboard "Agent Activity" bileşeni. (587 test %100 geçiyor). |
| `v0.6.2` | [`v0.6.2-step-6.03.md`](./v0.6.2-step-6.03.md) | Step 6.03 | **Tamamlandı** | Agent-002 (Görev Hijyeni) + Agent-003 (Durum İsteyici, LangGraph interrupt/resume, eskalasyon). (653 test %100 geçiyor). |
| `v0.6.3` | `v0.6.3-step-6.04.md` *(Hazırlanacak)* | Step 6.04 | **Sırada** | Agent-004 (Engel Yöneticisi / Blocker Manager) & Agent-009 (Kapsam Kayması Tespiti / Scope Creep Detection) — Olay güdümlü koruyucular (Tier A). |
| `v0.6.4` | `v0.6.4-step-6.05.md` *(Hazırlanacak)* | Step 6.05 | **Planlandı** | Agent-005 (Asenkron Standup / Async Daily Standup) & Agent-006 (Haftalık Rapor / Weekly Sprint Digest) — LLM destekli ekip iletişimi ve özetleme (Tier B). |
| `v0.6.5` | `v0.6.5-step-6.06.md` *(Hazırlanacak)* | Step 6.06 | **Planlandı** | Agent-007 (İş Yükü Dengeleyici / Workload Balancer) & Agent-008 (Sprint Asistanı / Sprint Assistant) — LLM destekli yeniden atama ve retro önerileri (`AgentProposal`, Tier B). |
| `v0.6.6` | `v0.6.6-step-6.07.md` *(Hazırlanacak)* | Step 6.07 | **Planlandı** | RAG & Semantik Arama: Proje dokümanları, geçmiş görevler ve sprintler üzerinde pgvector destekli bilgi sorgulama. |
| `v0.6.7` | `v0.6.7-step-6.08.md` *(Hazırlanacak)* | Step 6.08 | **Planlandı** | Faz 6 Konsolidasyon, E2E Multi-Agent Koordinasyon Doğrulaması ve Hardening. |

---

## 4. Claude Code İçin İpuçları ve Proje Kuralları

1. **Tailwind CSS v4:** `@tailwindcss/postcss` ve Tailwind v4 kullanılmaktadır. `tailwind.config.js` yerine modern v4 utility sınıflarını tercih edin.
2. **Merkezi Yetkilendirme (`src/lib/authz.ts`):** `requireSession`, `requireUserId`, `requireMembership`, `requireAdmin`, `requireAdminSession`, `assertNotProjectOwner` fonksiyonlarını kullanın. Manuel oturum/üyelik kontrolleri yazmayın.
3. **Prisma Singleton:** Daima `@/lib/prisma` üzerindeki `prisma` örneğini import edin.
4. **Server Actions:** `src/actions/` altında `"use server"` direktifi ile yazılmalı, her mutasyondan sonra `revalidatePath()` çağrılmalıdır.
5. **Saat ve Zaman:** Asla doğrudan `new Date()` ile bağımlı mantık kurmayın. `src/lib/clock.ts` (`getNow()`) ve Python'da `agent/src/clock.py` (`get_now()`) kullanın.
6. **Güvenlik:** Python container Next.js Internal API'sine istek atarken mutlaka `INTERNAL_API_SECRET` ile HMAC-SHA256 imzası (`x-agent-signature`, `x-agent-timestamp`) eklemelidir.
