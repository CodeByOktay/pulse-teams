# Faz 2.02 — Sprint Yönetim Sayfası, Görünümü & Görev-Sprint Entegrasyonu: Teknik Rapor

> **Faz:** 2 (v0.2.0 Hazırlığı)  
> **Başlık:** Sprint Yönetim Sayfası, Görünümü & Görev-Sprint Entegrasyonu  
> **Proje:** Pulse Project Manager (`C:\Pulse`)  
> **Durum:** ✅ Tamamlandı — Tüm kabul kriterleri ve testler karşılandı  
> **Tarih:** 18 Eylül 2026  

---

## 1. Yönetici Özeti (Executive Summary)

**Faz 2.02**, Faz 2.01 ile veritabanı ve sunucu katmanı (`schema.prisma` ve `src/actions/sprint.ts`) kurulan Sprint/Cycle mekanizmasını **kullanıcı arayüzü (UI), etkileşim katmanı ve ön uç iş kuralları** ile buluşturan adımdır.

Bu faz adımı kapsamında;
- Proje bazlı Sprint yönetim rotası (`/projects/[projectId]/sprints`) Server Component olarak inşa edilmiş,
- 5 yeni modüler Client bileşeni (`SprintCard`, `CreateSprintModal`, `EditSprintModal`, `CompleteSprintDialog`, `SprintTaskPicker`) geliştirilmiş,
- Proje genel gezinimini sağlayan `Sidebar` güncellenerek her proje altına **Board** ve **Sprints** ikili rotalandırması entegre edilmiş,
- Server Actions içindeki iş kuralları saf fonksiyonlara (`src/lib/sprint-logic.ts`) dönüştürülerek yüksek test edilebilirlik sağlanmış,
- 11 yeni Vitest testi eklenerek projedeki toplam test sayısı **27'den 38'e yükseltilmiş** ve **%100 başarı** korunmuştur.

---

## 2. Mimari ve Sayfa Yapısı (`/projects/[projectId]/sprints`)

Sprint yönetim rotası (`src/app/(main)/projects/[projectId]/sprints/page.tsx`), Next.js 16 App Router kurallarına uygun olarak bir **Server Component** olarak geliştirilmiştir:

### 2.1. Güvenlik & Veri Yükleme Stratejisi
1. **Kimlik Doğrulama:** `getServerSession(authOptions)` oturum kontrolü; oturumsuz isteklerde `/login` yönlendirmesi.
2. **Yetkilendirme:** `prisma.projectMember` üzerinden üyelik doğrulaması; izinsiz erişimlerde `notFound()`.
3. **İlişkisel Veri Çekme:** Projeye ait tüm sprintler, görev sayıları ve görevlerin durum grupları (`state.group`) ile birlikte tek sorguda çekilir (`eager loading`).
4. **Hiyerarşik Sıralama:** Sprintler önem sırasına göre dizilir:
   $$\text{ACTIVE (0)} \longrightarrow \text{DRAFT (1)} \longrightarrow \text{COMPLETED (2)}$$
   Aynı statüdeki sprintler `createdAt DESC` olarak listelenir.
5. **Boş Durum Yönetimi:** Projede hiç sprint bulunmadığında `EmptyState` bileşeni devreye girer ve doğrudan modal tetikleme butonu sunar.

---

## 3. UI Bileşenleri & Etkileşim Katmanı

`src/components/sprints/` altında 5 adet özel bileşen konumlandırılmıştır:

### 3.1. `SprintCard` (`sprint-card.tsx`)
Sprintlerin listelendiği ana kart bileşenidir:
- **Sol Aks:** Statüye göre renkli hap (pill) badge:
  - `DRAFT`: Gri (`bg-slate-100 text-slate-700`)
  - `ACTIVE`: Zümrüt yeşili/mavi vurgulu (`bg-emerald-100 text-emerald-800 border-l-4 border-blue-500`)
  - `COMPLETED`: Slate (`bg-slate-200 text-slate-600`)
- **Orta Bölüm:** Sprint adı, opsiyonel sprint hedefi (`goal`), formatlanmış tarih aralığı (`formatSprintDateRange`).
- **İlerleme Çubuğu:** `getSprintProgress` ile hesaplanan tamamlanma yüzdesi ve dinamik renkli bar (Active: mavi, Completed: yeşil).
- **Gecikme Tespiti:** `isSprintOverdue` fonksiyonu ile süresi geçmiş aktif sprintlerde kırmızı `"Gecikmiş!"` uyarısı.
- **Aksiyonlar Menüsü:**
  - `DRAFT`: Başlat (`startSprint`), Düzenle (`EditSprintModal`), Sil (`deleteSprint`).
  - `ACTIVE`: Tamamla (`CompleteSprintDialog`), Düzenle (`EditSprintModal`).
  - `COMPLETED`: Salt okunur detay inceleme.

### 3.2. `CreateSprintModal` (`create-sprint-modal.tsx`)
- Sprint adı (zorunlu), hedef metni, başlangıç ve bitiş tarihi girişleri.
- İstemci tarafı tarih doğrulaması: Bitiş tarihinin başlangıç tarihinden önce olması engellenir.
- Başarılı kayıtta otomatik form sıfırlama ve modal kapatma.

### 3.3. `EditSprintModal` (`edit-sprint-modal.tsx`)
- Mevcut verilerle önceden doldurulmuş form.
- Statü geçişi (`DRAFT` $\to$ `ACTIVE` $\to$ `COMPLETED`) dropdown seçimi.
- Server Action (`updateSprint`) ile atomik senkronizasyon.

### 3.4. `CompleteSprintDialog` (`complete-sprint-dialog.tsx`)
- Sprint kapatma işlemi öncesinde `completeSprint` action'ı ile kalan işlerin analizi.
- Tamamlanmamış görev sayısı (örn: *"Bu sprintte 4 görev henüz tamamlanmadı."*) kullanıcıya açıkça bildirilerek onay istenir.

### 3.5. `SprintTaskPicker` (`sprint-task-picker.tsx`)
- Aktif sprint ile proje görevlerini bağlayan köprü bileşenidir.
- Gerçek zamanlı görev başlığı metin araması (arama filtresi).
- Sprintte olmayan görevleri checkbox ile seçip tek tıkla sprinte dahil etme (`addTaskToSprint`).
- Mevcut sprint görevlerini listeleme ve çıkarma (`removeTaskFromSprint`).

---

## 4. Gezinim & Menü Entegrasyonu (`Sidebar`)

`src/components/layout/sidebar.tsx` bileşeni güncellenmiştir:
- Her projenin altında iki ana sekme oluşturulmuştur:
  1. 📋 **Board:** `/projects/[projectId]/board` (`LayoutGrid` ikonu)
  2. 📅 **Sprints:** `/projects/[projectId]/sprints` (`Calendar` ikonu)
- `usePathname()` ile aktif sekme tespiti yapılarak seçili rotaya `bg-slate-800 text-white` aktiflik stili atanmıştır.

---

## 5. İş Mantığı İzolasyonu & Refactoring (`sprint-logic.ts`)

Server action'lar içindeki iş kuralları saf (pure) fonksiyonlar haline getirilmiş ve `src/lib/sprint-logic.ts` dosyasına taşınmıştır. Böylece veritabanı veya HTTP mock'lamasına gerek kalmadan yüksek hızlı birim testleri uygulanabilmiştir:

1. **`validateSprintDates(startDate, endDate)`**:
   - Başlangıç ve bitiş tarihleri varsa, bitişin başlangıçtan sonra olduğunu teyit eder.
   - Eşit veya ters tarihlerde açıklayıcı hata mesajı döner.
2. **`canDeleteSprint(status)`**:
   - Yalnızca `DRAFT` statüsündeki sprintlerin silinmesine izin verir.
   - `ACTIVE` ve `COMPLETED` için koruma sağlar.
3. **`canStartSprint(existingActiveSprint)`**:
   - Projede hali hazırda aktif sprint bulunması durumunda yeni sprint başlatılmasını engeller.

`src/actions/sprint.ts` dosyası bu fonksiyonları içerecek şekilde güncellenmiş ve DRY (Don't Repeat Yourself) prensibine kavuşturulmuştur.

---

## 6. Test ve Kalite Güvencesi (QA)

### 6.1. Vitest Test Koşumu Sonucu (`npm test`)

```text
 RUN  v5.0.1 C:/Pulse

 ✓ src/lib/__tests__/sprint-actions.test.ts (11 tests) 11ms
 ✓ src/lib/__tests__/sprint-utils.test.ts (13 tests) 12ms
 ✓ src/lib/__tests__/board-filters.test.ts (5 tests) 10ms
 ✓ src/lib/__tests__/sort-order.test.ts (4 tests) 6ms
 ✓ src/lib/__tests__/sequence.test.ts (2 tests) 8ms
 ✓ src/lib/__tests__/colors.test.ts (3 tests) 6ms

 Test Files  6 passed (6)
      Tests  38 passed (38)
   Start at  15:13:40
   Duration  640ms
```

### 6.2. `sprint-actions.test.ts` Birim Test Dağılımı (11 Test)

| Test Grubu | Test Senaryosu | Beklenen Sonuç | Durum |
|------------|----------------|----------------|:-----:|
| `validateSprintDates` | Tarih belirtilmemişse geçerlidir | `{ valid: true }` | ✅ Geçti |
| `validateSprintDates` | Sadece startDate varsa geçerlidir | `{ valid: true }` | ✅ Geçti |
| `validateSprintDates` | Sadece endDate varsa geçerlidir | `{ valid: true }` | ✅ Geçti |
| `validateSprintDates` | endDate > startDate ise geçerlidir | `{ valid: true }` | ✅ Geçti |
| `validateSprintDates` | endDate < startDate ise geçersizdir | `{ valid: false, error: ... }` | ✅ Geçti |
| `validateSprintDates` | endDate === startDate ise geçersizdir | `{ valid: false }` | ✅ Geçti |
| `canDeleteSprint` | DRAFT sprint silinebilir | `{ allowed: true }` | ✅ Geçti |
| `canDeleteSprint` | ACTIVE sprint silinemez | `{ allowed: false, reason: ... }` | ✅ Geçti |
| `canDeleteSprint` | COMPLETED sprint silinemez | `{ allowed: false, reason: ... }` | ✅ Geçti |
| `canStartSprint` | Aktif sprint yoksa başlatılabilir | `{ allowed: true }` | ✅ Geçti |
| `canStartSprint` | Aktif sprint varsa başlatılamaz | `{ allowed: false, reason: ... }` | ✅ Geçti |

### 6.3. Tip Güvenliği (`npx tsc --noEmit`)
- TypeScript denetimi sıfır hata ile tamamlanmıştır.

---

## 7. Kabul Kriterleri Doğrulama Matrisi

| # | Kabul Kriteri | Durum | Doğrulama Yöntemi |
|---|---------------|:-----:|-------------------|
| 1 | `/projects/[id]/sprints` sayfası başarıyla derleniyor ve render ediliyor | ✅ | Server Component route & session/membership guard |
| 2 | `CreateSprintModal` ile yeni sprint oluşturulabiliyor | ✅ | Client modal + `createSprint` server action |
| 3 | `EditSprintModal` ile sprint bilgileri ve durumu düzenlenebiliyor | ✅ | Form state prefill + `updateSprint` |
| 4 | Sprint başlatma akışı çalışıyor (`DRAFT` $\to$ `ACTIVE`) | ✅ | `startSprint` + aktif sprint tekillik kontrolü |
| 5 | Sprint tamamlama akışı çalışıyor (`ACTIVE` $\to$ `COMPLETED`) | ✅ | `CompleteSprintDialog` + kalan görev uyarısı |
| 6 | Sprint silme kuralları korunuyor (Sadece `DRAFT` silinebilir) | ✅ | `canDeleteSprint` mantık kontrolü |
| 7 | Görev sprint'e eklenip çıkarılabiliyor (`SprintTaskPicker`) | ✅ | `addTaskToSprint` & `removeTaskFromSprint` |
| 8 | `Sidebar` bileşeninde Sprints ve Board linkleri aktif olarak çalışıyor | ✅ | Lucide ikonları & `usePathname` active state |
| 9 | Tüm Vitest testleri hatasız geçiyor | ✅ | 6 test dosyasında 38/38 test passed (%100) |
| 10 | Statik kod analizi ve TypeScript derlemesi hatasız | ✅ | `npx tsc --noEmit` hatasız (0 error) |

---

## 8. Faz 2 Yol Haritası & Sonraki Adım: Faz 2.03

Faz 2.02'nın başarıyla tamamlanmasıyla birlikte Faz 2'nin 2. etabı noktalanmıştır. Bir sonraki adım olan **Faz 2.03 (Liste Görünümü - List View)** için zemin hazırdır:

- **Faz 2.03 Hedefi:** `/projects/[projectId]/list` rotası oluşturularak görevlerin Excel/tablo formatında sıralanabilir, filtrelenebilir düz bir liste halinde sunulması.
- **Hazırlanacak Bileşenler:** `ListViewContainer`, `ListTable`, durum sütunları ve sıralanabilir başlıklar.
