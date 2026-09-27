# ADR-026: Bildirim Tercihleri, Bahsetme (Mention) ve Yaklaşan Son Tarih Uyarısı Mimarisi

- **Durum:** Kabul Edildi (Accepted)
- **Tarih:** 2026-09-21
- **Karar Vericiler:** Antigravity (Lead Architect & QA Authority), Claude Code (Builder)
- **Sürüm:** v0.4.3 (Faz 4 — Adım 4.03)
- **İlgili ADR:** [ADR-025-Uygulama İçi Bildirimler ve İstemci Polling Mimarisi](./ADR-025-uygulama-ici-bildirimler-ve-istemci-polling.md)

---

## 1. Bağlam ve Problem Tanımı (Context)

Pulse v0.4.2'de (Faz 4.02) PostgreSQL destekli, istemci polling tabanlı hafif ve dayanıklı bir bildirim sistemi (`Notification`, `TASK_ASSIGNED`, `COMMENT_ADDED`, `SPRINT_COMPLETED`) devreye alınmıştı. Ancak kullanıcıların bildirim hacmi arttıkça şu ihtiyaçlar doğdu:
1. **Bildirim Gürültüsü ve Tercih Kontrolü:** Kullanıcılar her yorumda bildirim almak istemeyebilir, ancak kendilerine direkt atanan görevleri veya sprint tamamlama gibi olayları kendi isteklerine göre filtreleyebilmelidir.
2. **Doğrudan Aksiyon ve Bahsetme (@mention):** Yorum bildirimlerini kapatmış bir kullanıcı dahi, yorum metninde doğrudan adı geçiyorsa (`@"Ahmet Yılmaz"` veya `@alex`) bunu kaçırmamalı ve yüksek öncelikli `TASK_MENTIONED` bildirimi almalıdır.
3. **Zaman Duyarlılığı ve Yaklaşan Son Tarihler:** Dashboard'da pasif olarak duran bitiş tarihlerine ek olarak; bugün (0 gün), yarın (1 gün) veya 3 gün sonra teslim edilmesi gereken görevler için atanan kişilere proaktif uyarılar iletilmelidir.

---

## 2. Alınan Mimari Kararlar (Decisions)

### A. Veritabanı Şeması & Migration Drift Düzeltmesi
- **`UserNotificationPreference` Modeli:**
  ```prisma
  model UserNotificationPreference {
    userId                   String   @id
    notifyTaskAssigned       Boolean  @default(true)
    notifyCommentAdded       Boolean  @default(true)
    notifyMentioned          Boolean  @default(true)
    notifyDueDateApproaching Boolean  @default(true)
    notifySprintClosed       Boolean  @default(false)
    createdAt                DateTime @default(now())
    updatedAt                DateTime @updatedAt

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  }
  ```
- **`NotificationType` Genişletmesi:** `TASK_MENTIONED` ve `DUE_DATE_APPROACHING` enum değerleri eklendi.
- **Migration Geçmişi Eşitlemesi:** Faz 4.02'de doğrudan veritabanına uygulanan `Notification` tablosu için geriye dönük `20260921000000_add_notifications` migration kaydı `prisma migrate resolve --applied` ile hizalandı ve yeni özellikler `20260921225014_add_notification_preferences` altında temiz bir migration olarak sürüldü.

### B. Saf İş Mantığı Fonksiyonları (`src/lib/notification-logic.ts`)
- `extractMentions(content)`: `@"Full Name"` (boşluklu tırnaklı) ve `@username` yapılarını regex ile yakalar, ilk görülme sırasını koruyarak tekrarsız (Set) liste döner.
- `resolveMentionedUserIds(handles, members)`: Bahsedilen rumuzları proje üyelerinin tam adıyla, boşluksuz haliyle veya ilk adıyla büyük/küçük harf duyarsız eşleştirerek geçerli `userId` kümesini döner.
- `shouldDeliverWithPreferences({ actorId, recipientId, type, preferences })`:
  - Kendi kendine bildirim yasağını (`actorId === recipientId`) her zaman en başta uygular (override edilemez).
  - Alıcı kullanıcının tercihlerine göre filtreler:
    - `TASK_ASSIGNED` -> `notifyTaskAssigned !== false` (varsayılan true)
    - `COMMENT_ADDED` -> `notifyCommentAdded !== false` (varsayılan true)
    - `TASK_MENTIONED` -> `notifyMentioned !== false` (varsayılan true)
    - `DUE_DATE_APPROACHING` -> `notifyDueDateApproaching !== false` (varsayılan true)
    - `SPRINT_COMPLETED` -> `notifySprintClosed === true` (varsayılan false / opt-in)
- `getApproachingDueTasks(tasks, now)`: Bitiş tarihi olan, `DONE` veya `CANCELLED` olmayan görevleri takvim günü bazında hesaplar; yalnızca 0 (bugün), 1 (yarın) ve 3 gün kalanları seçer.
- `formatDueDateNotificationSnippet(taskTitle, daysRemaining)`: Kalan güne göre yerelleştirilmiş bildirim mesajı üretir.

### C. Sunucu Aksiyonları & Çift Bildirimi Önleme
- `createComment`: Yorum eklendiğinde önce metindeki mention'lar çözümlenir. Mention edilen üyelere `TASK_MENTIONED` bildirimi iletilir. Göreve atanmış diğer kişilere ise mention edilmiş olmamaları koşuluyla (`!mentionedSet.has(assignee.userId)`) `COMMENT_ADDED` bildirimi gönderilir; böylece bir kişi aynı yorum için iki bildirim almaz.
- `checkApproachingDueDates`: Proje veya kullanıcı görevlerini tarar; aynı görev için aynı takvim gününde daha önce `DUE_DATE_APPROACHING` bildirimi oluşturulmuşsa tekrar oluşturmaz (idempotent kontrol).
- `getUserNotificationPreferences` & `updateUserNotificationPreferences`: Oturum kullanıcısına ait tercihleri upsert eder ve sayfa yollarını revalidate eder.

### D. Kullanıcı Arayüzü (UI) & İyimser Durum
- `NotificationPreferencesModal`: `NotificationPopover` başlığındaki ayarlar dişlisi ile açılır. 5 bildirim tercihi için anında iyimser (`optimistic`) güncelleme ve sunucu hatasında geri alma (`rollback`) ile çalışan şık toggle anahtarları sunar.
- `NotificationItem`: `TASK_MENTIONED` için `AtSign` ikonu (indigo rozet) ve `DUE_DATE_APPROACHING` için `Clock` ikonu (amber rozet) ile görselleştirilir.

---

## 3. Test Stratejisi (Antigravity QA)

- **Test Dosyası:** `src/lib/__tests__/notification-preferences.test.ts`
- **Kapsam:** 29 yeni birim testi; mention ayrıştırma, proje üyeleriyle eşleştirme, büyük/küçük harf toleransı, varsayılan ve özel tercihler, takvim günü eşikleri ve formatlayıcılar.
- **Sonuç:** 21 test dosyasında **393 test %100 başarılı**, `npx tsc --noEmit` 0 hata.

---

## 4. İleriye Dönük Notlar (E-posta ve Kanallar)

İlerleyen fazlarda harici bildirim kanalları (E-posta, Web Push) ekleneceğinde:
- `NotificationChannel` (`IN_APP`, `EMAIL`) enum'ı doğrudan `UserNotificationPreference` tablosuna `emailTaskAssigned`, `emailMentioned` vb. olarak veya kanal bazlı matris tablosu olarak eklenebilir.
- Mevcut `shouldDeliverWithPreferences` mantığı, teslimat kuralı zincirine kanal filtresini de kolayca dahil edecek şekilde genişletilebilir.
