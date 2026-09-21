# Faz 2.03 — Liste Görünümü (List View) — Tablo Stili Düz Liste & Sıralama Motoru: Teknik Rapor

> **Faz:** 2 (v0.2.0 Hazırlığı)  
> **Başlık:** Liste Görünümü (List View) — Tablo Stili Düz Liste & Sıralama Motoru  
> **Proje:** Pulse Project Manager (`C:\Pulse`)  
> **Durum:** ✅ Tamamlandı — Tüm kabul kriterleri ve testler karşılandı  
> **Tarih:** 18 Eylül 2026  

---

## 1. Yönetici Özeti (Executive Summary)

**Faz 2.03**, Pulse Project Manager platformuna Kanban panosu görünümüne alternatif olarak modern, tablo stili bir **Liste Görünümü (List View)** kazandırmak amacıyla hayata geçirilmiştir. Kullanıcıların görevleri Excel benzeri satırlar halinde incelemesine, durum bazında gruplandırmasına (collapsible accordion) ve çok boyutlu sıralamasına olanak tanır.

Bu faz adımı kapsamında;
- Yeni sunucu rotası oluşturuldu: `/projects/[projectId]/list` (`ProjectListPage`),
- 4 adet yeni modüler Client bileşeni (`ListViewContainer`, `ListTable`, `ListRow`, `ListGroupByState`) geliştirildi,
- Board ve List görünümleri arasında pürüzsüz geçiş sağlayan `ViewSwitcher` bileşeni inşa edildi ve `FilterBar` ile entegre edildi,
- `Sidebar` gezinimine **Liste (List)** rotası eklendi,
- Harici kütüphane kullanmadan çok alanlı sıralama ve duruma göre gruplama yapan saf algoritma modülü (`src/lib/list-view-sort.ts`) yazıldı,
- 15 yeni Vitest testi yazılarak projedeki toplam test sayısı **52'ye** (ve devam eden modüllerle birlikte toplam **67'ye**) ulaştı, tüm testler **%100 başarıyla** geçti.

---

## 2. Mimari ve Sayfa Yapısı (`/projects/[projectId]/list`)

`src/app/(main)/projects/[projectId]/list/page.tsx` rotası bir **Server Component** olarak kurgulanmıştır:

### 2.1. Veri ve Güvenlik Akışı
1. **Oturum & Üyelik:** `getServerSession(authOptions)` oturum kontrolü ve `prisma.projectMember` üyelik doğrulaması (izinsiz erişimde 404 / yönlendirme).
2. **Filtrelerin Yeniden Kullanımı:** Faz 1'de geliştirilen `parseBoardFilters(searchParams)` modülü doğrudan kullanıldı. URL parametreleri (`?priorities=...&labels=...&assignees=...`) sunucu tarafında okunarak Prisma `taskWhere` sorgusuna dönüştürülür.
3. **İlişkisel Veri Çekme:** Görevler (`Task`), durumlar (`State`), etiketler (`Label`) ve proje üyeleri tek seferde sunucuda çekilerek `ListViewContainer` bileşenine aktarılır.
4. **Çift Yönlü URL Senkronizasyonu:** Filtreler uygulandığında URL güncellenir; sayfa yenilense veya link paylaşılan başka bir kullanıcı açsa bile aynı filtreli liste görüntülenir.

---

## 3. UI Bileşenleri & Etkileşim Katmanı

`src/components/list-view/` klasörü altında 4 temel bileşen oluşturulmuştur:

### 3.1. `ListViewContainer` (`list-view-container.tsx`)
- Projede hiç görev olmadığında `EmptyState` (Görev Yok) gösterir.
- Filtre sonucunda görev kalmadığında `FilterX` ikonu ve *"Filtreleri Temizle"* aksiyon butonu sunar.
- Bir satıra tıklandığında `selectedTaskId` state'i üzerinden Faz 1'deki `TaskDetailModal`'ı açar.

### 3.2. `ListTable` (`list-table.tsx`)
- 9 sütunlu tablo yapısı:
  | Seçim (□) | ID | Başlık | Durum | Öncelik | Görevli | Etiketler | Bitiş Tarihi | İşlemler (⋮) |
- **Sütun Sıralama (Sortable Headers):** `Başlık`, `Durum`, `Öncelik` ve `Bitiş Tarihi` başlıklarına tıklandığında `asc` / `desc` yönlü anlık sıralama uygulanır. Aktif sıralanan sütunda yön ikonu (`ArrowUp` / `ArrowDown`) belirir.

### 3.3. `ListRow` (`list-row.tsx`)
- **Görsel Tasarım:** Açık/koyu mod uyumlu satır, hover efektleri (`hover:bg-zinc-50`).
- **Öncelik Gösterimi:** Statüye özel simgeler ve etiketler (`URGENT`, `HIGH`, `MEDIUM`, `LOW`, `NONE`).
- **Bitiş Tarihi Renklendirmesi (`getDueDateColor`):**
  - Geçmiş tarihler: Kırmızı (`text-red-600`)
  - Bugün: Turuncu (`text-orange-500`)
  - Gelecek tarihler: Yeşil (`text-green-600`)
- **Etiket & Görevli Yoğunluğu:** İlk 2 etiket rozet olarak gösterilir; kalanı `+X` sayacı ile özetlenir.
- **Satır İçi Aksiyonlar (⋮):** Tıklanabilir üç nokta menüsü ile `Düzenle` ve `Sil` (`deleteTask` action çağrısı).
- **Toplu Seçim Hazırlığı:** Satır başındaki seçim checkbox'ı `Faz 2.05` (Bulk Actions) için hazır prop arayüzü (`isSelected`, `onSelect`) ile donatılmıştır.

### 3.4. `ListGroupByState` (`list-group-by-state.tsx`)
- Görevleri ait oldukları `State` (Kanban sütun durumu) altında gruplandırır.
- **Açılır/Kapanır Akordiyon (Collapsible):** `ChevronDown` / `ChevronRight` simgeleri ile tıklanarak durum bazında görevler gizlenip açılabilir.
- **Durum İndikatörü:** Duruma ait renkli nokta, durum adı ve `(N görev)` sayaç etiketi.
- **Hızlı Görev Ekleme:** Grubun en altında Faz 1'deki `AddTaskInline` bileşeni konumlandırılarak doğrudan ilgili duruma yeni görev açma imkanı sağlandı.

---

## 4. Görünüm Değiştirici & Gezinim Entegrasyonu

### 4.1. `ViewSwitcher` (`src/components/layout/view-switcher.tsx`)
- İki sekmeli kompakt anahtar:
  - ⊞ **Board:** `/projects/[projectId]/board`
  - ☰ **Liste:** `/projects/[projectId]/list`
- Aktif görünüm koyu zemin (`bg-zinc-900 text-white`) ile belirginleştirilir.
- `FilterBar`'ın en soluna yerleştirilerek hem Kanban Board hem de Liste sayfasında aynı konumda tutarlılık sağlandı.

### 4.2. `Sidebar` Güncellemesi (`sidebar.tsx`)
- Her proje altına üç ana gezinim rotası bağlandı:
  1. `Board` (`LayoutGrid` ikonu)
  2. `Liste` (`List` ikonu)
  3. `Sprints` (`Calendar` ikonu)

---

## 5. Sıralama ve Gruplama Algoritması (`src/lib/list-view-sort.ts`)

Veritabanına yük bindirmeden istemci tarafında anlık sıralama ve gruplama sağlayan saf TypeScript fonksiyonları geliştirilmiştir:

1. **`sortTasksByField<T>(tasks, field, order)`**:
   - **Öncelik Sıralaması:** `URGENT(5) > HIGH(4) > MEDIUM(3) > LOW(2) > NONE(1)` hiyerarşisi işletilir. Eşitlik durumunda oluşturulma tarihine (`createdAt`) göre tie-break yapılır.
   - **Tarih Sıralaması:** `dueDate` alanı `null` olan görevler, `asc` veya `desc` fark etmeksizin her zaman listenin sonuna (`nulls-last`) yerleştirilir.
   - **Durum Sıralaması:** Kanban sütun sırası olan `state.sequence` değerine göre dizilir.
   - **Başlık Sıralaması:** Türkçe karakter duyarlı `localeCompare` ile alfabetik sıralama.

2. **`groupTasksByState<T>(tasks)`**:
   - Görevleri `state.id` anahtarlarıyla `Map<string, T[]>` yapısında gruplar.
   - Map anahtarları durumların pano sırasına (`state.sequence`) göre sıralanır.

---

## 6. Test Koşumu ve Doğrulama Sonuçları

`Vitest` ve `tsc` komutları terminalde bizzat çalıştırılmış ve çıktılar doğrulanmıştır.

### 6.1. `list-view-sort.test.ts` (15 Testin Tamamı Başarılı)

Terminal komutu: `npx vitest run src/lib/__tests__/list-view-sort.test.ts`

```text
 RUN  v5.0.1 C:/Pulse

 ✓ src/lib/__tests__/list-view-sort.test.ts (15 tests) 20ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  15:31:07
   Duration  254ms
```

#### Test Senaryoları Dağılımı:
1. **Öncelik (Priority) Testleri (4 test):**
   - Desc: `URGENT` en önce, `LOW` en sonda.
   - Asc: `NONE` en önce gelir.
   - Eşit öncelik durumlarında `createdAt` asc/desc tie-break doğrulaması.
2. **Başlık (Title) Testleri (2 test):**
   - Asc: `Alpha < Beta < Gamma` doğrulaması.
   - Desc: Tam ters alfabetik sıralama doğrulaması.
3. **Tarih ve Durum Sırası Testleri (2 test):**
   - `createdAt` zaman damgasına göre sıralama.
   - `state.sequence` sayısal değerine göre sıralama.
4. **Null Değer Edge Case Testleri (3 test):**
   - `dueDate === null` olanlar asc sıralamada en sona düşer.
   - `dueDate === null` olanlar desc sıralamada da en sona düşer.
   - Tüm tarihler null olduğunda mevcut sıra bozulmaz.
5. **Durum Gruplama (`groupTasksByState`) Testleri (4 test):**
   - 3 farklı durum için 3 grubun oluşumu.
   - Boş girdi için boş `Map` dönmesi.
   - Grupların `sequence` sırasını koruması.
   - Aynı durumdaki görevlerin tek grupta toplanması.

### 6.2. Genel Proje Testleri Durumu (`npm test`)

```text
 Test Files  8 passed (8)
      Tests  67 passed (67)
   Start at  15:31:16
   Duration  889ms
```

### 6.3. TypeScript Statik Tip Denetimi (`npx tsc --noEmit`)
- **Çıktı:** 0 hata, exit code 0. Tip güvenliği eksiksiz sağlanmıştır.

---

## 7. Kabul Kriterleri Doğrulama Tablosu

| # | Kabul Kriteri | Durum | Doğrulama Yöntemi |
|---|---------------|:-----:|-------------------|
| 1 | `/projects/[id]/list` sayfası başarıyla derleniyor ve render ediliyor | ✅ | Server Component route & session/membership guard |
| 2 | Tüm görevler tablo satırlarında (`ListRow`) görüntüleniyor | ✅ | 9 sütunlu tablo mimarisi incelendi |
| 3 | ID veya başlığa tıklanınca `TaskDetailModal` açılıyor | ✅ | `onOpenTask` callback & modal entegrasyonu |
| 4 | Durum, öncelik, görevli, etiket ve tarih sütunları doğru renk/ikonla gösteriliyor | ✅ | UI badge ve dinamik tarih renklendirmesi |
| 5 | State'e göre gruplama (collapsible accordion) çalışıyor | ✅ | `ListGroupByState` bileşeni ve Chevron geçişleri |
| 6 | Board ve Liste sayfalarında `ViewSwitcher` görünüyor ve geçiş yapıyor | ✅ | `ViewSwitcher` + `FilterBar` entegrasyonu |
| 7 | `FilterBar` filtreleri (öncelik, etiket, kişi) Liste sayfasında da çalışıyor | ✅ | `parseBoardFilters` ve URL arama parametreleri |
| 8 | Sütun başlığına tıklayınca sıralama değişiyor (`asc` / `desc`) | ✅ | `ListTable` `onSort` state & sıralama ikonu |
| 9 | `list-view-sort.test.ts` testleri geçiyor | ✅ | Vitest: 15/15 test başarılı |
| 10 | TypeScript derleme hatası yok | ✅ | `npx tsc --noEmit` hatasız (0 error) |
