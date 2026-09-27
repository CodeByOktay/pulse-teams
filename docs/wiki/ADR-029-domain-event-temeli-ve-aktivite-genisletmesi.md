# ADR-029: Domain Event Temeli, Aktivite ve Bildirim Tipleri Genişletmesi

- **Durum:** Kabul Edildi (Accepted)
- **Tarih:** 2026-09-25
- **Karar Vericiler:** Antigravity (Lead Architect & QA Authority), Claude Code (Builder)
- **Sürüm:** v0.5.1 (Phase 5 — Step 5.01)
- **İlgili ADR:** [ADR-013-Aktivite Geçmişi & Denetim Günlüğü](./ADR-013-aktivite-gecmisi-ve-denetim-gunlugu.md), [ADR-023-Görev İlişkileri ve Bağımlılık Mimarisi](./ADR-023-gorev-iliskileri-ve-bagimlilik-mimarisi.md), [ADR-025-Uygulama İçi Bildirimler](./ADR-025-uygulama-ici-bildirimler-ve-istemci-polling.md), [ADR-028-AI Destekli Proaktif Proje Koordinasyon Mimarisi](./ADR-028-ai-destekli-proaktif-proje-koordinasyonu.md)

---

## 1. Bağlam ve Problem Tanımı (Context)

ADR-028 ile kararlaştırılan "Üç Katmanlı AI Proaktif Proje Koordinasyon Mimarisi" doğrultusunda, Katman A (Deterministik Domain Otomasyonu) ve Katman B (AI Destekli İlerleme Yorumlama) adımlarının hayata geçirilebilmesi için sistemin "sinir sisteminin" kurulması gerekiyordu.

Mevcut sistemdeki kısıtlar ve ihtiyaçlar:
1. **Genel Durum Değişikliği vs. Açık Tamamlanma Event'i:** Görevler `updateTask` ile güncellendiğinde sadece jenerik `TASK_STATE_CHANGED` aktivitesi kaydediliyordu. Ancak bir görevin `DONE` grubuna geçmesi (tamamlanması), bağımlılık grafını tetikleyen birincil bir domain event'tir.
2. **Bağımlılık Çözülme Bildirimi Eksikliği:** Bir blocker tamamlandığında, bekleyen bağımlı görevin sahibine haber verecek açık bir bildirim (`TASK_UNBLOCKED`) ve aktivite kaydı bulunmuyordu.
3. **İlerleme Döngüsü Olayları:** İlerleyen adımlarda (Step 5.03 & 5.04) ekip üyelerinden ilerleme durumu talep edilmesi ve yanıt alınması için `PROGRESS_REQUESTED` ve `PROGRESS_RESPONDED` olay tiplerine ihtiyaç vardı.
4. **AI Eylemlerinin İnsan Eylemlerinden Ayrıştırılması:** Activity tablosunda hangi değişikliğin insan, hangisinin AI ajanı tarafından yapıldığının şeffafça izlenebilmesi (`isAiGenerated`) zorunluydu.
5. **Aşırı Mühendislikten Kaçınma (Pragmatik Event Kancası):** RabbitMQ, Kafka veya veritabanı Outbox tablosu gibi karmaşık kuyruk sistemleri yerine, mevcut Next.js ve Prisma mimarisine uygun, senkron ve dayanıklı bir post-transaction hook mekanizması benimsenmelidir.

---

## 2. Alınan Mimari Kararlar (Decisions)

### A. Veritabanı Şeması ve Enum Genişletmeleri (`prisma/schema.prisma`)
Veritabanı üzerinde geriye dönük uyumlu migration (`20260925185210_add_ai_coordination_events`) uygulanarak şu değişiklikler yapıldı:
- **`NotificationType` Enum Genişletmesi (+2 değer, toplam 7):**
  - `TASK_UNBLOCKED`: Görevin aktif engelleyicisi kalmadığında atananlara iletilen bildirim.
  - `PROGRESS_REQUESTED`: Görev hakkında ekip üyesinden durum bilgisi istendiğinde iletilen bildirim.
- **`ActivityType` Enum Genişletmesi (+6 değer, toplam 23):**
  - `TASK_COMPLETED`: Görevin `DONE` grubuna geçişi için açık denetim kaydı.
  - `TASK_UNBLOCKED`: Görevin üzerindeki engelin kalktığını belirten kayıt.
  - `PROGRESS_REQUESTED`: İlerleme talebi gönderildiğinde oluşan kayıt.
  - `PROGRESS_RESPONDED`: Kullanıcı ilerleme yanıtı verdiğinde oluşan kayıt.
  - `AI_SUGGESTION_APPLIED`: AI önerisi insan tarafından onaylandığında oluşan kayıt.
  - `AI_SUGGESTION_REJECTED`: AI önerisi reddedildiğinde oluşan kayıt.
- **`Activity.isAiGenerated` Alanı:**
  - `Boolean @default(false)` alanı eklendi. UI katmanında AI eylemlerine `🤖` rozeti verilmesi sağlandı.

### B. Saf Domain Mantığı İzolasyonu (`src/lib/automation-logic.ts`)
Antigravity mimari ilkelerine uygun olarak tüm otomasyon ve geçiş kuralları Prisma veya ağ bağımlılığı olmayan saf (pure) fonksiyonlar olarak yazıldı:
- `isCompletionTransition(oldGroup, newGroup)`: Eski durum `DONE` değilken yeni durum `DONE` grubuna geçtiyse `true` döner (aynı grup içi değişimlerde veya geri almalarda tetiklenmez).
- `isReopeningTransition(oldGroup, newGroup)`: `DONE` grubundan açık duruma geri dönüldüğünü (`DONE -> IN_PROGRESS`) tespit eder.
- `isTaskFullyUnblocked(blockerStates)`: Çoklu blocker koruması. Dizideki tüm blocker'lar `DONE` ise `true`, en az biri bitmediyse `false` döner.
- `findNewlyUnblockedTasks(params)`: Biten bir görev sonrası etkilenen bağımlı görevler arasından artık hiçbir aktif engeli kalmayanları ve onların atanan kullanıcılarını filtreler.
- `formatUnblockedNotificationMessage(blockerTitle, dependentTitle)`: Standart Türkçe bildirim başlığı ve mesaj metni üretir.
- `filterSelfNotifications(recipientIds, actorId)`: Bir kullanıcı kendi tamamladığı görev için kendisine unblocked bildirimi alamaz; aktör kimliği alıcı listesinden elenir.

### C. Activity Logger & Bildirim Uyumluluğu
- `logActivity` fonksiyonu opsiyonel `isAiGenerated?: boolean` parametresini destekleyecek şekilde güncellendi.
- `formatActivityMessage` fonksiyonuna 6 yeni aktivite tipi için Türkçe açıklamalar eklendi.
- `shouldDeliverWithPreferences` fonksiyonunda yeni bildirim tiplerinin varsayılan olarak teslim edilmesi ve self-notification engelleme kuralı korundu.
- `NotificationItem` bileşeninde `TASK_UNBLOCKED` (LockOpen, emerald rozet) ve `PROGRESS_REQUESTED` (CircleHelp, sky rozet) için tip güvenli ikon ve renk haritalamaları tanımlandı.

---

## 3. Sonuçlar (Consequences)

### Olumlu Sonuçlar (Pros)
- **Sağlam Altyapı:** Step 5.02 (TASK_UNBLOCKED otomasyonu) ve Step 5.03/5.04 için gereken veri modelleri ve saf fonksiyonlar sıfır hata ile hazırlandı.
- **Yüksek Test Kapsamı:** Antigravity QA tarafından yazılan 32 yeni birim test ile toplam test sayısı 416'dan 448'e yükseldi (%100 yeşil).
- **Tip Güvenliği:** Strict TypeScript (`npx tsc --noEmit`) 0 hata ile çalıştı; `Record<NotificationType, ...>` sözlükleri eksiksiz tamamlandı.
- **Sıfır LLM Maliyeti:** Tüm durum geçişleri ve engel kontrolleri deterministik algoritmalarla çalışır, yapay zeka token maliyeti oluşturmaz.

### Olumsuzluklar / Ödünler (Cons)
- Activity tablosuna yeni bir kolon (`isAiGenerated`) eklendiği için mevcut satırlar `false` varsayılan değerini aldı (veritabanı boyutu açısından ihmal edilebilir bir maliyet).

---

## 4. Doğrulama ve İmzalar
- `npm test`: **448 test, 23 suite, %100 başarılı**
- `npx tsc --noEmit`: **0 derleme hatası**
- Git Commit: `2411a8b`
- Git Tag: `v0.5.1`
