# Faz 2.05 — Toplu İşlemler (Bulk Actions) — Çoklu Görev Seçimi, Toplu Güncelleme & Silme: Teknik Rapor

> **Faz:** 2 (v0.2.0 Hazırlığı)  
> **Başlık:** Toplu İşlemler (Bulk Actions) — Çoklu Görev Seçimi, Toplu Güncelleme & Silme  
> **Proje:** Pulse Project Manager (`C:\Pulse`)  
> **Durum:** ✅ Tamamlandı — Tüm kabul kriterleri ve testler karşılandı  
> **Tarih:** 18 Eylül 2026  

---

## 1. Yönetici Özeti (Executive Summary)

**Faz 2.05**, Pulse Project Manager platformunun Liste Görünümü (List View) üzerinde birden fazla görevin aynı anda seçilerek tek tıkla toplu olarak güncellenmesini (durum, öncelik, sprint ataması) ve güvenli biçimde silinmesini sağlayan **Toplu İşlemler (Bulk Actions)** yeteneğini sisteme kazandırmıştır.

Bu faz adımı kapsamında;
- `src/actions/task.ts` içerisine atomik `$transaction` batch mekanizmasıyla çalışan `bulkUpdateTasks` ve `bulkDeleteTasks` Server Action'ları eklendi,
- Proje içi görev izolasyonunu denetleyen `requireSameProjectTasks` güvenlik katmanı entegre edildi,
- Durum yönetimini hafifleten ve reaktif çalışan `useBulkSelection` custom React hook'u geliştirildi,
- Saf iş mantığını izole eden `src/lib/bulk-selection-logic.ts` modülü inşa edildi,
- Kullanıcı dostu, klavye (ESC) duyarlı ve silme eylemleri için tehlike vurgulu `ConfirmDialog` onay modalı yazıldı,
- Sayfanın altında veya üstünde dinamik olarak açılan sticky `BulkActionBar` eylem çubuğu konumlandırıldı,
- Tablo başlığında kısmi seçimleri gösteren **üçüncü durum (indeterminate checkbox)** desteği sağlandı,
- 18 yeni Vitest testi yazılarak projedeki toplam test sayısı **67'den 85'e çıkarıldı (%100 başarı)**.

---

## 2. Server Actions Katmanı (`src/actions/task.ts`)

Toplu veri operasyonları için yüksek performanslı ve güvenlik kontrollü 2 yeni Server Action geliştirilmiştir:

### 2.1. Güvenlik ve Proje İzolasyonu (`requireSameProjectTasks`)
- İstemciden gelen `taskIds: string[]` dizisindeki tüm görevlerin veritabanında var olduğu teyit edilir.
- Görevlerin tamamının **tek ve aynı projeye** ait olduğu doğrulanır (`projectIds.size === 1`).
- İşlemi yapan kullanıcının ilgili projenin üyesi olup olmadığı (`requireMembership`) denetlenir (`403 Forbidden` / Yetkisiz işlem engeli).

### 2.2. `bulkUpdateTasks(taskIds, data)`
- **Kapasite Sınırı:** En az 1, en fazla 100 görev (`validateBulkUpdateLimit`).
- **Atomik Güncelleme:** `prisma.$transaction` içinde:
  - `stateId` verilmişse: `tx.task.updateMany({ where: { id: { in: taskIds } }, data: { stateId } })`
  - `priority` verilmişse: `tx.task.updateMany({ where: { id: { in: taskIds } }, data: { priority } })`
  - `assigneeId` verilmişse: `tx.taskAssignee.createMany` (`skipDuplicates: true` ile idempotent atama).
- İşlem sonunda Liste ve Board sayfalarının önbellekleri (`revalidatePath`) tazelenir.

### 2.3. `bulkDeleteTasks(taskIds)`
- **Kapasite Sınırı:** En az 1, en fazla 50 görev (`validateBulkDeleteLimit`).
- **Toplu Silme:** `tx.task.deleteMany({ where: { id: { in: taskIds } } })` çağrısı ile ilişkili tüm etiket, görevli ve yorum kayıtları `onDelete: Cascade` ile temizlenir.
- Silinen görev adedi (`{ deletedCount }`) döndürülür.

---

## 3. Durum Yönetimi & Seçim Mantığı (`useBulkSelection` & `bulk-selection-logic`)

İstemci tarafında seçim durumunu yönetmek için React bağımlılığından izole saf algoritmalar yazılmıştır:

### 3.1. Saf İş Mantığı (`src/lib/bulk-selection-logic.ts`)
1. **`toggleItem(selectedIds, id)`**: Seçili `Set`'i immutably günceller (orijinal Set'i mutasyona uğratmaz, yeni Set döner).
2. **`selectAll(items)`**: Listedeki tüm görev ID'lerini barındıran yeni bir Set üretir.
3. **`isAllSelected(selectedIds, items)`**: Listenin boş olmaması ve tüm öğelerin seçili olması durumunda `true` döner.
4. **`validateBulkDeleteLimit(count)`**: $0$ için hata, $1 \le count \le 50$ geçerli, $>50$ hata döner.
5. **`validateBulkUpdateLimit(count)`**: $0$ için hata, $1 \le count \le 100$ geçerli, $>100$ hata döner.

### 3.2. Custom Hook (`src/lib/use-bulk-selection.ts`)
- `useCallback` ve `useMemo` optimizasyonları ile gereksiz yeniden render'lar engellenmiştir.
- `selectedIds`, `isSelected(id)`, `toggleSelect(id)`, `selectAll()`, `clearSelection()`, `isAllSelected` ve `selectedCount` değerlerini sunar.

---

## 4. Kullanıcı Arayüzü & Etkileşim Bileşenleri

### 4.1. `BulkActionBar` (`src/components/list-view/bulk-action-bar.tsx`)
- Yalnızca `selectedCount > 0` olduğunda görünür.
- **Sol Bölüm:** Seçilen görev adedi (`"N görev seçildi"`) ve seçimi tek tıkla iptal eden `X` butonu.
- **Aksiyonlar:**
  - **Durumu Değiştir:** Projenin sütun durumlarını içeren dinamik dropdown menü.
  - **Önceliği Değiştir:** `Yok`, `Düşük`, `Orta`, `Yüksek`, `Acil` dropdown menüsü.
  - **Sprint'e Ekle:** Projede aktif bir sprint varsa (`activeSprint`) doğrudan sprint'e toplu bağlama opsiyonu.
  - **Sil:** Kırmızı tehlike butonu; tıklandığında doğrudan silmek yerine onay modalını tetikler.
- **Yüklenme Durumu (`isLoading`):** İşlem sürerken spinner (`Loader2`) gösterilir ve tüm butonlar kilitlenir.

### 4.2. `ConfirmDialog` (`src/components/ui/confirm-dialog.tsx`)
- Yanlışlıkla görev silinmesini engelleyen genel amaçlı modal.
- `ESC` tuşu dinleyicisi ve arka plan karartmasına tıklayarak iptal edebilme.
- Tehlikeli işlemler için kırmızı onay butonu (`confirmVariant="danger"`).

### 4.3. Tablo Başlığı ve İndeterminate Checkbox Entegrasyonu (`ListTable`)
- Tablo başlığındaki genel checkbox:
  - Hiçbir görev seçili değilse: Boş.
  - Tüm görevler seçili ise: İşaretli (`checked`).
  - Görevlerin bir kısmı seçili ise: `HTMLInputElement.indeterminate = true` üçüncü durumu etkinleşir.

---

## 5. Test Koşumu ve Kalite Güvencesi (QA)

### 5.1. `bulk-selection.test.ts` (18 Testin Tamamı Başarılı)

Terminal komutu: `npx vitest run src/lib/__tests__/bulk-selection.test.ts`

```text
 RUN  v5.0.1 C:/Pulse

 ✓ src/lib/__tests__/bulk-selection.test.ts (18 tests) 10ms

 Test Files  1 passed (1)
      Tests  18 passed (18)
   Start at  15:55:45
   Duration  245ms
```

#### Test Senaryoları Dağılımı:
1. **`toggleItem` Testleri (4 test):**
   - Boş Set'e yeni id ekleme.
   - Var olan id'yi çıkarma.
   - Var olmayan id'yi ekleme.
   - Orijinal Set'in mutasyona uğramadığının doğrulanması (Immutability).
2. **`selectAll` Testleri (2 test):**
   - 3 öğeli dizi için 3 elemanlı Set dönmesi.
   - Boş dizi için boş Set dönmesi.
3. **`isAllSelected` Testleri (4 test):**
   - Tüm öğeler seçiliyken `true`.
   - Bir öğe eksikken `false`.
   - Liste boşken `false`.
   - `selectedIds` boşken liste doluyken `false`.
4. **`validateBulkDeleteLimit` Testleri (4 test):**
   - `count = 0` $\to$ Hata: *"En az bir görev seçilmelidir."*
   - `count = 1` $\to$ Geçerli.
   - `count = 50` $\to$ Geçerli (Sınır değer).
   - `count = 51` $\to$ Hata: *"Aynı anda en fazla 50 görev silinebilir."*
5. **`validateBulkUpdateLimit` Testleri (4 test):**
   - `count = 0` $\to$ Hata.
   - `count = 1` $\to$ Geçerli.
   - `count = 100` $\to$ Geçerli (Sınır değer).
   - `count = 101` $\to$ Hata: *"Aynı anda en fazla 100 görev güncellenebilir."*

### 5.2. Genel Proje Testleri Durumu (`npm test`)

Terminal komutu: `npm test`

```text
 RUN  v5.0.1 C:/Pulse

 ✓ src/lib/__tests__/activity-logger.test.ts (14 tests) 12ms
 ✓ src/lib/__tests__/sprint-actions.test.ts (11 tests) 11ms
 ✓ src/lib/__tests__/list-view-sort.test.ts (15 tests) 30ms
 ✓ src/lib/__tests__/board-filters.test.ts (5 tests) 11ms
 ✓ src/lib/__tests__/sprint-utils.test.ts (13 tests) 12ms
 ✓ src/lib/__tests__/bulk-selection.test.ts (18 tests) 13ms
 ✓ src/lib/__tests__/sort-order.test.ts (4 tests) 7ms
 ✓ src/lib/__tests__/colors.test.ts (3 tests) 7ms
 ✓ src/lib/__tests__/sequence.test.ts (2 tests) 8ms

 Test Files  9 passed (9)
      Tests  85 passed (85)
   Start at  15:55:50
   Duration  1.11s
```

### 5.3. Statik Tip Denetimi (`npx tsc --noEmit`)
- TypeScript denetimi hatasız tamamlandı (Exit code: 0).

---

## 6. Kabul Kriterleri Doğrulama Matrisi

| # | Kabul Kriteri | Durum | Doğrulama Yöntemi |
|---|---------------|:-----:|-------------------|
| 1 | Liste görünümünde görev satırlarında checkbox mevcut | ✅ | `ListTable` & `ListRow` prop bağlantısı |
| 2 | "Tümünü Seç" checkbox'ı indeterminate desteğiyle çalışıyor | ✅ | `selectAllRef.current.indeterminate` doğrulaması |
| 3 | `BulkActionBar` görev seçilince görünüyor, 0'da kayboluyor | ✅ | `selectedCount > 0` şartlı render'ı |
| 4 | "Durumu Değiştir" dropdown ile toplu durum güncelleniyor | ✅ | `bulkUpdateTasks` ({ stateId }) çağrısı |
| 5 | "Önceliği Değiştir" dropdown ile toplu öncelik güncelleniyor | ✅ | `bulkUpdateTasks` ({ priority }) çağrısı |
| 6 | "Sil" butonu `ConfirmDialog` onay modalını açıyor ve siliyor | ✅ | `ConfirmDialog` + `bulkDeleteTasks` |
| 7 | İşlem tamamlandığında seçim otomatik sıfırlanıyor | ✅ | `clearSelection()` çağrısı |
| 8 | `bulk-selection.test.ts` testleri geçiyor | ✅ | Vitest: 18/18 test başarılı |
| 9 | Tüm proje testleri (85 test) ve `tsc` hatasız | ✅ | Vitest 85/85 & TypeScript 0 error |

---

## 7. Faz 2 Yol Haritası & Sonraki Adım: Faz 2.06

Faz 2.05'in tamamlanmasıyla birlikte Faz 2'nin 5. adımı başarıyla geride bırakılmıştır.

- **Sıradaki Adım:** **Faz 2.06 — Markdown Açıklama Desteği (Rich Text & Preview)**
- **Hedef:** Görev açıklamalarında `react-markdown` ile kalın yazı, başlıklar, listeler, kod blokları ve canlı önizleme sekmesi (Düzenle / Önizle) yeteneğinin kazandırılması.
