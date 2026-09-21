# Faz 4.02 — Uygulama İçi Bildirimler ve İstemci Polling Mimarisi: Teknik Rapor & ADR-025

Bu teknik rapor ve mimari karar kaydı (ADR-025), Pulse projesinin takım içi işbirliğini anlık kılmak amacıyla hayata geçirilen **Uygulama İçi Bildirim Sistemi (In-App Notification)** ile **İstemci Taraflı Periyodik Polling (Sorgulama)** altyapısının mimari kararlarını, veri modelini ve test kapsamını belgeler.

---

## 1. Bağlam ve Problem Tanımı

### 1.1 Problem
- **İşbirliği Görünürlüğü Eksikliği:** Kullanıcılar kendilerine yeni bir görev atandığında, atandıkları bir göreve yeni bir yorum yazıldığında veya bir sprint tamamlandığında bunu yalnızca ilgili sayfaları manuel gezerek fark edebiliyordu.
- **Harici / Karmaşık Altyapı Maliyeti:** WebSocket veya Server-Sent Events (SSE) gibi stateful bağlantılar, Vercel/Node.js App Router ortamında sunucu bağlantı limitleri ve reconnection yönetimi nedeniyle yüksek bakım maliyeti doğurur.
- **Kendi Kendine Bildirim (Self-notification) Kirliliği:** Bir kullanıcı kendi görevine yorum yaptığında veya kendi kendine görev atadığında kendisine bildirim üretilmesi kullanıcı deneyimini bozar.

### 1.2 Çözüm Hedefleri
1. **Hafif ve Güvenilir Polling Mekanizması:** Sayfa ilk açıldığında anlık yükleme ve arka planda her 30 saniyede bir hafif `getUnreadNotificationCount` sorgusu.
2. **Tarayıcı Dostu Sekme Yönetimi:** `document.visibilityState` API'si ile sekme arka plandayken sorguları duraklatma; sekmeye dönüldüğünde hemen tazeleme.
3. **Kalıcı ve İndeksli Veri Modeli:** `Notification` tablosu üzerinde `[userId, read]` ve `[userId, createdAt]` indeksleri ile $O(1)$/$O(\log N)$ performans.
4. **Dayanıklı / Hata Yutucu Tetikleme:** Bildirim oluşturma (`createNotification`) hatalarının ana veritabanı işlemlerini (`prisma.$transaction`) asla kesintiye uğratmaması.
5. **Faz 4.03 (Bildirim Tercihleri) Uyumluluğu:** Saf `shouldDeliverNotification` filtreleme kancası ile kullanıcı tercihlerine hazır altyapı.

---

## 2. Mimari Kararlar ve Bileşen Yapısı

### 2.1 Veri Modeli (`prisma/schema.prisma`)

```prisma
enum NotificationType {
  TASK_ASSIGNED
  COMMENT_ADDED
  SPRINT_COMPLETED
}

model Notification {
  id        String           @id @default(cuid())
  userId    String           // Bildirimi alan kullanıcı (Alıcı)
  actorId   String?          // Aksiyonu gerçekleştiren kullanıcı (Gönderen)
  type      NotificationType
  title     String
  message   String
  link      String?          // Derin bağlantı (?task= veya /sprints)
  read      Boolean          @default(false)
  createdAt DateTime         @default(now())

  user      User             @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)
  actor     User?            @relation("ActorNotifications", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([userId, read])
  @@index([userId, createdAt])
}
```

### 2.2 Tetikleyici Olay Noktaları (Event Triggers)
Tüm tetikleyiciler `shouldDeliverNotification(actorId, recipientId)` denetiminden geçer. `actorId === recipientId` durumunda bildirim üretilmez.
1. **`src/actions/assignee.ts` (`assignUserToTask`):** Atanan kullanıcıya `TASK_ASSIGNED` bildirimi (`?task=` linkiyle).
2. **`src/actions/comment.ts` (`createComment`):** Göreve atanan diğer kullanıcılara `COMMENT_ADDED` bildirimi (yorum metninin Markdown formatından arındırılmış özetiyle).
3. **`src/actions/sprint.ts` (`completeSprint`):** Projenin tüm üyelerine `SPRINT_COMPLETED` bildirimi (`/projects/[id]/sprints` linkiyle).

### 2.3 İstemci Polling Hook'u (`src/lib/use-notification-polling.ts`)
- **Başlangıç:** Mount anında bildirimleri ve okunmamış sayısını çeker.
- **Aralık:** 30 saniyede bir `getUnreadNotificationCount()` çalıştırır.
- **Görünürlük Denetimi:** Sekme gizlendiğinde (`document.hidden`) timer durur, odak kazanıldığında anında tetiklenir.
- **İyimser Güncelleme:** Bildirime tıklandığında anında okunmuş (`read: true`) kabul edilir; hata durumunda geri alınır.

### 2.4 Arayüz Bileşenleri (UI)
- **`NotificationBell` (`src/components/notifications/notification-bell.tsx`):** Header'da avatarın solunda zil ikonu ve 9+'a kadar dinamik sayaç rozeti.
- **`NotificationPopover` (`src/components/notifications/notification-popover.tsx`):** 360px açılır liste, "Tümünü Okundu İşaretle" butonu, göreve hızlı geçiş ve göreli zaman gösterimi (`formatRelativeTime`).
- **`Header` (`src/components/layout/header.tsx`):** Profil menüsünün soluna entegre edildi.

---

## 3. Test Stratejisi (Antigravity QA)

- **Test Dosyası:** `src/lib/__tests__/notification-logic.test.ts`
- **Test Sayısı:** 16 yeni test
- **Toplam Test Durumu:** 20 test süiti, **364 test (%100 Başarılı)**
- **Kapsam:**
  - `shouldDeliverNotification`: Kendi kendine bildirim engeli (`actorId === recipientId`), farklı kullanıcı izni ve sistem/null actor desteği.
  - `formatNotificationSnippet`: Markdown stripping (`**`, `` ` ``, `[]()`), kelime sınırında kesme ve üç nokta (`...`) ekleme, varsayılan 80 karakter sınır denetimi.
  - `buildNotificationDeepLink`: Pano ve görev çekmecesi için `?task=` URL formatı.
  - `buildSprintNotificationDeepLink`: Sprint sayfası URL formatı.
  - `countUnreadNotifications`: Okunmamış sayaç hesaplama, boş liste ve tam dolu liste testleri.

---

## 4. Faz 4.03 Entegrasyon Noktaları (Bildirim Tercihleri)

Faz 4.03'te geliştirilecek olan "Bildirim Tercihleri" ([✓] Görev atanınca bildir, [✓] Yorum gelince bildir, [ ] Sprint kapanınca bildir) ayarları için:
- `NotificationType` enum'u (`TASK_ASSIGNED`, `COMMENT_ADDED`, `SPRINT_COMPLETED`) tercihler tablosundaki boolean alanlarla 1-e-1 eşleşmektedir.
- `shouldDeliverNotification` fonksiyonu üçüncü parametre olarak kullanıcı tercihlerini kabul edebilecek esneklikte tasarlanmıştır.
