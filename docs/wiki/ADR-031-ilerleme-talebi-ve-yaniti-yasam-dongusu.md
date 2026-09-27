# ADR-031: İlerleme Talebi ve Yanıtı Yaşam Döngüsü (Progress Request-Response)

- **Durum:** Kabul Edildi (Accepted)
- **Tarih:** 2026-09-25
- **Karar Vericiler:** Antigravity (Lead Architect & QA Authority), Claude Code (Builder)
- **Sürüm:** v0.5.3 (Phase 5 — Step 5.03)
- **İlgili ADR:** [ADR-013-Aktivite Geçmişi & Denetim Günlüğü](./ADR-013-aktivite-gecmisi-ve-denetim-gunlugu.md), [ADR-025-Uygulama İçi Bildirimler](./ADR-025-uygulama-ici-bildirimler-ve-istemci-polling.md), [ADR-028-AI Destekli Proaktif Proje Koordinasyon Mimarisi](./ADR-028-ai-destekli-proaktif-proje-koordinasyonu.md), [ADR-029-Domain Event Temeli ve Aktivite Genişletmesi](./ADR-029-domain-event-temeli-ve-aktivite-genisletmesi.md)

---

## 1. Bağlam ve Problem Tanımı (Context)

Pulse v0.5.2 ile birlikte görev kilitleri kalktığında bağımlı görev sahibine bildirim iletilmesi sağlandı. Ancak proje yöneticisinin (veya ilerleyen aşamalarda proaktif yapay zeka ajanının) ekip üyelerinden görev durumu hakkında bilgi toplayabileceği, doğal dilde yanıt alabileceği ve bu süreci denetim günlüğünde izleyebileceği bir **İlerleme Talep & Yanıt Yaşam Döngüsü (Progress Request-Response Lifecycle)** bulunmuyordu.

Temel gereksinimler ve güvenlik kuralları:
1. **Veri Modeli İhtiyacı:** Bekleyen, yanıtlanmış ve süresi geçmiş taleplerin takibi için `ProgressRequest` ve verilen serbest metin yanıtları için `ProgressResponse` modellerine ihtiyaç vardı.
2. **Mükerrer Talep Engeli:** Bir görev için zaten yanıt bekleyen (`PENDING`) bir talep varken ikinci bir talep açılarak kullanıcının bildirim bombardımanına tutulması önlenmelidir.
3. **Yetkilendirme ve Kapsam Koruması:**
   - İlerleme talebi yalnızca o göreve atanmış üyelere gönderilebilmelidir (rastgele üyelere talep açılamaz).
   - Talebi yalnızca hedeflenen atanan kullanıcı (veya proje yöneticisi) yanıtlayabilmelidir.
   - Tamamlanmış (`DONE`) veya iptal edilmiş (`CANCELLED`) görevler için ilerleme istenemez.
4. **Eşzamanlı Yanıt ve Durum Koruması (Race Condition Guard):** Bir talep yalnızca `PENDING` durumundayken yanıtlanabilir; aynı anda iki sekmeden gönderilen yanıtlar veya süresi dolmuş talepler veritabanı düzeyinde engellenmelidir.
5. **Karakter Sınırları ve Doğrulama:** Yanıt metni serbest doğal dil olmalı, ancak boş bırakılamamalı ve makul sınırları (3 - 2000 karakter) aşmamalıdır.

---

## 2. Alınan Mimari Kararlar (Decisions)

### A. Veritabanı Modelleri & Migration (`prisma/schema.prisma`)
Migration: `20260925192217_add_progress_request_models`
- **`enum ProgressRequestStatus`:** `PENDING`, `RESPONDED`, `EXPIRED`, `CANCELLED`
- **`model ProgressRequest`:**
  - `taskId`, `projectId`, `recipientId`, `requestedById`, `reason` (`manual` | `unblocked` | `scheduled`), `status`, `dueAt`.
  - `Task`, `Project`, `User (recipient)` ve `User (requestedBy)` ilişkileri.
- **`model ProgressResponse`:**
  - `progressRequestId`, `responderId`, `content` (`@db.Text`), `createdAt`.
  - `ProgressRequest` ve `User (responder)` ilişkileri.
- Bu eklemelerle veritabanı model sayısı **16'dan 18'e**, enum sayısı **7'den 8'e** yükseldi.

### B. Saf Doğrulama ve Mantık İzolasyonu (`src/lib/progress-logic.ts`)
- `canRequestProgress(taskStateGroup, assigneesCount, hasPendingRequest)`:
  - `DONE` veya `CANCELLED` grubunda -> izin verilmez.
  - Atanan üye yoksa -> izin verilmez.
  - Zaten bekleyen talep varsa -> izin verilmez.
  - Aksi halde izin verilir.
- `validateProgressResponseContent(content)`:
  - Kırpılmış metin 3 karakterden kısa veya 2000 karakterden uzunsa anlamlı Türkçe hata döner.
- `formatProgressRequestNotification(taskTitle, requesterName)`:
  - Bildirim başlığı (`"İlerleme durumu talep edildi"`) ve mesaj metni üretir.
- Karakter sınır sabitleri dışa aktarılarak (`PROGRESS_RESPONSE_MIN_LENGTH = 3`, `PROGRESS_RESPONSE_MAX_LENGTH = 2000`) UI karakter sayacında tutarlılık sağlandı.

### C. Server Actions (`src/actions/progress.ts`)
- `createProgressRequest`:
  - Görev üyeliği ve atanan doğrulaması yapar.
  - Mükerrer talep kontrolü uygular.
  - `tx` içinde `ProgressRequest` oluşturur ve `PROGRESS_REQUESTED` aktivitesi kaydeder.
  - `shouldDeliverWithPreferences` kontrolüyle alıcıya in-app bildirim iletir.
- `submitProgressResponse`:
  - `session.user.id === recipientId` veya admin yetkisini denetler.
  - Transaction içinde `updateMany({ where: { id, status: "PENDING" }, data: { status: "RESPONDED" } })` ile atomik durum güncellemesi yaparak eşzamanlı çift yanıt riskini yok eder.
  - `ProgressResponse` kaydı açar ve `PROGRESS_RESPONDED` aktivitesini (özet metin ile) günlüğe işler.
- `getTaskProgressData`:
  - Görevin bekleyen talebini, geçmiş yanıtlarını, atananlarını ve yetki durumunu tek çağrıda UI'a sunar.

### D. Kullanıcı Arayüzü Entegrasyonu (`TaskProgressSection`)
- [`src/components/task-detail/task-progress-section.tsx`](../../src/components/task-detail/task-progress-section.tsx) bileşeni oluşturuldu.
- Görev detayında ilişkiler bloğu ile aktivite sekmesi arasına yerleştirildi:
  - Birden fazla atanan varsa açılır menüden kullanıcı seçilerek **"İlerleme Sor"** butonu tetiklenir.
  - Hedef kullanıcı için kehribar (amber) renkli odak kartı açılır: Karakter sayaçlı metin kutusu ve **[İlerlemeyi Gönder]** butonu.
  - Diğer ekip üyeleri için *"X kullanıcısından ilerleme yanıtı bekleniyor"* bilgilendirme rozeti görünür.
  - Verilen son yanıtlar katlanabilir (accordion) liste ile görev detayında sergilenir.

---

## 3. Sonuçlar (Consequences)

### Olumlu Sonuçlar (Pros)
- **Yapılandırılmış Veri Toplama:** Kullanıcıların doğal dil yanıtları serbest metin olarak toplanır; Step 5.04'teki LLM yorumlama motoru için eksiksiz girdi hazırlandı.
- **Yüksek Güvenlik & Yarış Durumu Koruması:** Mükerrer bildirimler ve eşzamanlı yanıt çatışmaları veritabanı kilitleriyle önlendi.
- **Antigravity QA Güvencesi:** Yazılan 20 yeni birim test ile toplam test sayısı 488'e ulaştı (%100 yeşil).

---

## 4. Doğrulama ve İmzalar
- `npm test`: **488 test, 25 suite, %100 başarılı**
- `npx tsc --noEmit`: **0 derleme hatası**
- Git Commit: `v0.5.3` adayı
