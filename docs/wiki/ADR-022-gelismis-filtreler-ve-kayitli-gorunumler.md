# Faz 3.06 — Gelişmiş Filtreler & Kayıtlı Görünümler: Teknik Rapor
Bu teknik rapor, Pulse projesinin pano ve liste görünümlerinde görevlerin çok boyutlu kriterlerle taranmasını sağlayan, filtreleme mantığını merkezileştiren ve kullanıcıların özel filtre kombinasyonlarını saklayabilmesini sağlayan Faz 3.06 geliştirmesinin mimari yapısını, filtre dönüşüm algoritmalarını ve test stratejisini sunar.

1. Giriş ve Amaç
1.1 Problem Tanımı
	• Sınırlı Filtre Kriterleri: Önceki sürümlerde filtreleme yalnızca Öncelik, Etiket ve Görevli alanlarıyla sınırlıydı; Durum Grubu (TODO, IN_PROGRESS, DONE, CANCELLED), Son Teslim Tarihi (dueDate) veya başlık metni bazında arama yapılamıyordu.
	• Tekrarlayan Kod (Code Duplication): Hem Board hem de List view sayfalarında URL parametrelerinden Prisma where clause üretme mantığı ayrı ayrı yazılmıştı.
	• Kalıcılık Eksikliği: Kullanıcılar sıkça başvurdukları filtre setlerini (örneğin "Acil ve Bu Hafta Teslim Edilecekler") her ziyaretlerinde baştan seçmek zorundaydı.
1.2 Çözüm Hedefleri
	1. Genişletilmiş Filtre Kriterleri:
		○ Durum Grubu (group): TODO, IN_PROGRESS, DONE, CANCELLED çoklu seçimi.
		○ Tarih Filtresi (due): overdue (gecikmişler), today (bugün), this_week (bu hafta), no_date (tarihsiz).
		○ Hızlı Metin Arama (q): Başlıkta büyük/küçük harf duyarsız kelime araması.
	2. Merkezi Prisma Where Oluşturucu (buildTaskWhereFromFilters): Tüm filtreleri tek bir saf fonksiyonda toplayarak sayfalardaki tekrarlı SQL mantığını ortadan kaldırma.
	3. Tek Tıkla Hızlı Filtre Çipleri (Quick Filter Chips): "Bana Atananlar", "Acil Görevler", "Gecikmişler", "Tamamlanmamışlar" düğmeleriyle tek tıkla toggle filtreleme.
	4. Kayıtlı Görünümler (Saved Views):
		○ Proje bazlı localStorage üzerinde saklanan özel filtre setleri.
		○ Hazır varsayılan görünümler ("Varsayılan", "Benim Görevlerim", "Acil Durumlar").
		○ Kullanıcı oturumundan bağımsız çalışan dinamik yer tutucu (__me__).

2. Mimari ve Bileşen Hiyerarşisi

FilterBar (src/components/filters/filter-bar.tsx)
├── Üst Satır: Detaylı Seçiciler & Sıralama
│   ├── ViewSwitcher (Board | Liste | Backlog)
│   ├── PriorityFilter (PopOver - Çoklu Seçim)
│   ├── LabelFilter (PopOver - Çoklu Seçim)
│   ├── AssigneeFilter (PopOver - Çoklu Seçim)
│   ├── GroupFilter (YENİ - TODO / IN_PROGRESS / DONE / CANCELLED)
│   ├── DueDateFilter (YENİ - Gecikmiş / Bugün / Bu Hafta / Tarihsiz)
│   ├── SearchInput (YENİ - Metin Arama Kutusu)
│   ├── Filtreleri Temizle Butonu (Aktif filtre sayacı ile)
│   └── SortSelector (Sıralama Alanı ve Artan/Azalan Yönü)
└── Alt Satır: Hızlı Aksiyonlar ve Kayıtlı Görünümler
    ├── QuickFilterChips (Tek Tıkla Toggle Çipleri)
    │   ├── [Bana Atananlar] (Mevcut kullanıcı ID'sini ekler/kaldırır)
    │   ├── [Acil Görevler] (priority=URGENT)
    │   ├── [Gecikmişler] (due=overdue)
    │   └── [Tamamlanmamışlar] (group=TODO,IN_PROGRESS)
    └── SavedViewsMenu (Kayıtlı Görünümler Menüsü)
        ├── Hazır Görünümler Listesi (Aktif olan vurgulanır)
        ├── "Geçerli Görünümü Kaydet" Butonu & İsim Girişi
        └── Özel Görünümleri Silme Desteği


3. Tarih ve Filtre İş Mantığı (src/lib/board-filters.ts)
Tarih sınırları ve Prisma where nesnesi inşası sunucudan bağımsız saf fonksiyonlarla yönetilir:
3.1 Deterministik Hafta ve Gün Aralıkları
	• Hafta Başlangıcı Kuralı: Sistemde haftanın Pazartesi başladığı garanti altına alınmıştır (startOfWeek ve endOfWeek).
	• resolveDueDateRange(due, now):
		○ overdue: $\text{dueDate} < \text{startOfDay(now)}$
		○ today: $\text{startOfDay(now)} \le \text{dueDate} \le \text{endOfDay(now)}$
		○ this_week: $\text{startOfWeek(now)} \le \text{dueDate} \le \text{endOfWeek(now)}$
		○ no_date: $\text{dueDate} = \text{null}$
3.2 Merkezi Where Clause Üretimi (buildTaskWhereFromFilters)
Board ve List sayfalarında tekrarlanan Prisma sorgu mantığı tek bir fonksiyona indirgenmiştir:

typescript
export function buildTaskWhereFromFilters(filters: BoardFilters, now: Date = new Date()): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};
  if (filters.priorities.length > 0) where.priority = { in: filters.priorities };
  if (filters.labelIds.length > 0) where.labels = { some: { labelId: { in: filters.labelIds } } };
  if (filters.assigneeIds.length > 0) where.assignees = { some: { userId: { in: filters.assigneeIds } } };
  if (filters.groups.length > 0) where.state = { group: { in: filters.groups } };
  if (filters.due) {
    const range = resolveDueDateRange(filters.due, now);
    where.dueDate = range.kind === "isNull" ? null : { ...(range.gte && { gte: range.gte }), ...(range.lte && { lte: range.lte }), ...(range.lt && { lt: range.lt }) };
  }
  if (filters.query.length > 0) where.title = { contains: filters.query, mode: "insensitive" };
  return where;
}


4. Kayıtlı Görünümler Sistemi (src/lib/saved-views-logic.ts & use-saved-views.ts)
4.1 URL Roundtrip Serileştirme
Aktif filtre seti kayıpsız bir şekilde URL query string'ine dönüştürülür ve tekrar okunur: $$\text{BoardFilters} \xrightarrow{\text{serializeBoardFilters}} \text{QueryString} \xrightarrow{\text{parseBoardFilters}} \text{BoardFilters}$$
4.2 Dinamik Kullanıcı Yer Tutucusu (__me__ Placeholder)
"Benim Görevlerim" varsayılan görünümünde statik bir kullanıcı ID'si bulunamaz. Bu sorun soyut bir yer tutucu ile çözülmüştür:
	• Kayıtlı query: assignee=__me__
	• Çalışma anı çözümlemesi: resolveSavedViewQuery(query, currentUserId) fonksiyonu __me__ dizesini oturumdaki kullanıcının gerçek ID'si ile değiştirir.
4.3 İstemci Tarafı Depolama Güvencesi
	• Anahtar: pulse:saved-views:${projectId} (Proje bazlı izolasyon).
	• Gizli sekme veya devre dışı bırakılmış depolama durumlarında uygulama çökmez, işlem sessizce atlanır.

5. Değiştirilen ve Eklenen Dosyalar
Dosya	Tür	Rolü
src/lib/board-filters.ts	Genişletildi	BoardFilters genişletildi, resolveDueDateRange, serializeBoardFilters, buildTaskWhereFromFilters eklendi.
src/lib/saved-views-logic.ts	YENİ	Kayıtlı görünüm oluşturma, serileştirme ve __me__ çözümleme saf fonksiyonları.
src/lib/use-saved-views.ts	YENİ	localStorage üzerinde kayıtlı görünümleri yöneten React hook'u.
src/components/filters/group-filter.tsx	YENİ	StateGroup bazlı popover filtre bileşeni.
src/components/filters/due-date-filter.tsx	YENİ	Tarih durumlarına göre filtreleme popover bileşeni.
src/components/filters/search-input.tsx	YENİ	Hızlı metin arama input'u.
src/components/filters/quick-filter-chips.tsx	YENİ	Tek tıkla filtre toggle eden çip butonlar.
src/components/filters/saved-views-menu.tsx	YENİ	Kayıtlı görünümleri seçme, ekleme ve silme menüsü.
src/app/(main)/projects/[projectId]/board/page.tsx	Güncellendi	Tekrarlı Prisma where kodu kaldırıldı, buildTaskWhereFromFilters kullanıldı.
src/app/(main)/projects/[projectId]/list/page.tsx	Güncellendi	Tekrarlı Prisma where kodu kaldırıldı, buildTaskWhereFromFilters kullanıldı.
src/lib/__tests__/advanced-filters.test.ts	YENİ	36 senaryoyu kapsayan kapsamlı Vitest test paketi.

6. Test Kapsamı ve Senaryoları (advanced-filters.test.ts)
src/lib/__tests__/advanced-filters.test.ts dosyasında 36 adet Vitest testi yer almaktadır:
	1. Tarih Aralığı Predicate Fonksiyonları (11 test):
		○ overdue: Dünkü tarihi gecikmiş sayma, bugünkü ve tarihsiz görevleri gecikmiş saymama.
		○ today: Günün farklı saatlerini doğru eşleştirme, yarını reddetme.
		○ this_week: Pazartesi başlangıcı ve Pazar bitişi sınır kontrolleri, sonraki haftayı dışlama.
		○ no_date: Yalnızca dueDate === null durumunu eşleştirme.
	2. parseBoardFilters Genişletilmiş Alanlar (6 test):
		○ CSV formatındaki group parametresini ayrıştırma ve geçersiz değerleri eleme.
		○ GROUP_FILTERS içinde BACKLOG olmadığını doğrulama.
		○ due ve q parametrelerinin doğru okunması ve temizlenmesi (trim).
	3. Prisma Where Clause Üretimi (5 test):
		○ group, due=overdue, due=no_date, q için doğru Prisma operatörlerinin üretimi (in, lt, null, contains).
		○ Boş filtre durumunda {} boş nesne dönme.
	4. Çoklu Filtre Birleşimleri (3 test):
		○ Öncelik + Durum Grubu + Görevli + Arama parametrelerinin tek bir AND bloğunda birleşmesi.
		○ Tarih ve etiket filtrelerinin birlikte uygulanması.
		○ isBoardFiltered fonksiyonunun yeni kriterlerle senkron çalışması.
	5. Kayıtlı Görünümler & Serialization (11 test):
		○ serializeBoardFilters ve parseBoardFilters kayıpsız roundtrip doğrulaması.
		○ resolveSavedViewQuery fonksiyonunun __me__ yer tutucusunu doğru ID ile değiştirmesi.
		○ DEFAULT_SAVED_VIEWS bütünlük testi.
		○ parseSavedViewsFromStorage için bozuk JSON ve geçersiz nesne korumaları.
		○ findMatchingSavedViewId ile aktif URL'ye uyan görünümün tespiti.

7. Doğrulama ve Sistem Durumu
Faz 3.06 geliştirmesi sonrası gerçekleştirilen doğrulama sonuçları:
	• Vitest Testleri: 17 test dosyasında 291 testin tamamı %100 başarılı olarak geçti (36 yeni test eklendi).
	• TypeScript Tip Denetimi: npx tsc --noEmit hatasız tamamlandı.
	• Production Build: npm run build ile Board ve List sayfaları optimize biçimde derlendi.
	• Git Commit: 30d48cf feat: (Faz 3.06) add advanced filters, quick filter chips, saved views and tests olarak sürümlendi.

8. Özet ve Değerlendirme
Faz 3.06 ile Pulse; hem pano hem liste görünümlerinde saniyeler içinde hedeflenen görevlere ulaşmayı sağlayan esnek arama ve filtreleme araçlarına kavuşmuştur. Özellikle Hızlı Filtre Çipleri ve Kayıtlı Görünümler (Saved Views) yetenekleri, uygulamanın Jira ve Linear seviyesinde profesyonel bir üretkenlik aracına dönüşmesinde kilit rol oynamıştır.
