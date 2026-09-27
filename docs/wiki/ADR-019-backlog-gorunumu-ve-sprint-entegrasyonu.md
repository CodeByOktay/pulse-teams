# Faz 3.03 — Backlog Görünümü & Sprint Entegrasyonu: Teknik Rapor
Bu teknik rapor, Pulse projesinde sprintlerden bağımsız görev havuzunun yönetilmesini, görevlerin sprintler ve backlog arasında güvenle taşınmasını ve sprint tamamlama ilerlemelerinin görselleştirilmesini sağlayan Faz 3.03 geliştirmesinin mimari ve teknik detaylarını sunar.

1. Giriş ve Amaç
1.1 Problem Tanımı
	• Sprint Dışı Görevlerin Görünmezliği: Önceki sürümlerde görevler ya panoda bir duruma bağlıydı ya da sprint yönetim ekranında seçiliyordu; ancak sprintlere dahil edilmemiş, planlama aşamasındaki görevleri listeleyen merkezi bir Backlog alanı yoktu.
	• Geçmiş Sprint Kayıtlarının Bozulma Riski: Pulse'ta görev ile sprint ilişkisi SprintTask ara tablosu üzerinden çoktan-çoğa (M:N) kurulmuştur. Bir görev geçmişte tamamlanmış (COMPLETED) bir sprintte yer almış olabilir. Görevi "Backlog'a taşıma" veya "başka bir sprinte aktarma" işlemi sırasında bu geçmiş verilerin yanlışlıkla silinmesi sprint geçmişi ve hız (velocity) metriklerini bozabilirdi.
	• Sprint İlerleme Eksikliği: Sprintlerin tamamlanma yüzdesi ve kalan iş yükü görsel olarak takip edilemiyordu.
1.2 Çözüm Hedefleri
	1. /projects/[projectId]/backlog Sayfası: Linear ve Jira standartlarında, üstte aktif/taslak sprint kartları, altta ise backlog görev tablosu içeren kompakt planlama ekranı.
	2. Geçmişi Koruyan Taşıma Mantığı: Görevler backlog veya sprintler arasında taşınırken yalnızca aktif (ACTIVE) veya taslak (DRAFT) bağlantılar güncellenmeli, tamamlanmış (COMPLETED) sprint kayıtları dokunulmaz kalmalıdır.
	3. Division-by-Zero Güvenli Progress Bar: Semantik StateGroup === "DONE" bazlı tamamlama yüzdesi ve renk kodlu ilerleme çubukları.
	4. Entegre Navigasyon: Sidebar ve ViewSwitcher bileşenlerine (Board / Liste / Backlog) 3'lü görünüm entegrasyonu.

2. Kritik Mimari Karar: "Backlog" Tanımı ve Veri Bütünlüğü
2.1 Bir Görev Ne Zaman "Backlog"dadır?
Veritabanında ayrı bir isBacklog boolean bayrağı tutmak yerine, mevcut ilişkisel veri yapısından türetilen deklaratif bir yaklaşım benimsenmiştir:
	Kural: Bir görev, projedeki hiçbir ACTIVE veya DRAFT sprinte bağlı değilse Backlog'dadır. Geçmişte bir COMPLETED sprintte yer almış olması, şu an aktif bir sprintte değilse backlog havuzunda yer almasına engel değildir.

typescript
// Prisma Sorgu Kriteri (src/app/(main)/projects/[projectId]/backlog/page.tsx)
prisma.task.findMany({
  where: {
    projectId,
    sprints: { none: { sprint: { status: { in: ["ACTIVE", "DRAFT"] } } } },
  },
  // ...
})

2.2 Geçmişi Koruyan Silme Algoritması
Görev başka bir sprinte taşınırken veya backlog'a çıkartılırken silinecek sprint bağlantıları saf fonksiyonla filtrelenir:

typescript
// src/lib/backlog-logic.ts
export function canDeleteSprintTaskLink(status: SprintStatus): boolean {
  return status !== "COMPLETED"; // COMPLETED bağlantılar ASLA silinemez
}

export function getRemovableSprintIds(
  sprintTasks: { sprintId: string; sprint: { status: SprintStatus } }[],
): string[] {
  return sprintTasks
    .filter((st) => canDeleteSprintTaskLink(st.sprint.status))
    .map((st) => st.sprintId);
}

Bu sayede bir görevin yaşam döngüsü boyunca hangi sprintlerde koştuğu geriye dönük raporlanabilir kalır.

3. Bileşen Mimarisi ve Arayüz Hiyerarşisi

ProjectBacklogPage (Server Component - /projects/[id]/backlog)
├── Header (Breadcrumb: Pulse / [Proje] / Backlog)
├── ViewSwitcher (Board | Liste | Backlog)
└── BacklogPageContainer (Client Component - State & Modals)
    ├── Aktif & Taslak Sprintler Bölümü
    │   └── SprintProgressCard (Grid)
    │       ├── Durum Rozeti (Aktif: Mavi, Taslak: Gri)
    │       ├── Sprint Adı (Link -> /sprints)
    │       └── Progress Bar (% ve completed/total görev sayısı)
    ├── Backlog Görev Havuzu
    │   ├── Başlık & Sayaç: "Backlog (N)"
    │   ├── EmptyState (Görev yoksa "Backlog boş" illüstrasyonu)
    │   └── BacklogTaskTable
    │       └── BacklogTaskRow (Her satır)
    │           ├── ID Rozeti (PRJ-12)
    │           ├── Görev Başlığı
    │           ├── Durum & Öncelik Rozetleri
    │           ├── Atanan Avatarları & Etiketler
    │           └── MoveToSprintMenu (Açılır Popover - "Sprint'e Taşı")
    └── TaskDetailModal (Satıra tıklandığında açılan slide-over panel)


4. Server Actions ve Mutasyon Akışları (src/actions/sprint.ts)
4.1 moveTaskToSprint(taskId: string, targetSprintId: string)
	1. Oturum & Yetki Kontrolü: Kullanıcı oturumu doğrulanır, hedef sprint bulunur ve requireMembership(targetSprint.projectId, userId) çağrılır.
	2. Sprint Uygunluk Doğrulaması: canMoveTaskToSprint(targetSprint) kontrolü ile COMPLETED bir sprinte görev eklenmesi engellenir.
	3. Proje Çaprazlama Koruması: task.projectId === targetSprint.projectId doğrulanır.
	4. Transaction İzolasyonu (prisma.$transaction):
		○ Görevin bağlı olduğu önceki aktif/taslak sprint bağlantıları tespit edilir (getRemovableSprintIds).
		○ Önceki aktif/taslak SprintTask kayıtları silinir ve her biri için TASK_SPRINT_REMOVED aktivitesi loglanır.
		○ Hedef sprint için yeni SprintTask kaydı oluşturulur ve TASK_SPRINT_ADDED loglanır.
	5. Revalidate: Backlog, Sprints, List ve Board sayfaları tek seferde önbellekten temizlenir.
4.2 moveTaskToBacklog(taskId: string)
	1. Görevin yalnızca ACTIVE veya DRAFT olan SprintTask kayıtları silinir.
	2. COMPLETED kayıtlarına dokunulmaz.
	3. TASK_SPRINT_REMOVED aktivite kaydı düşülür.
	4. İlgili tüm proje sayfaları revalidate edilir.

5. Saf İş Mantığı Modülü (src/lib/backlog-logic.ts)
Bu modüldeki tüm fonksiyonlar pure function olarak tasarlanmış, veritabanı veya DOM bağımlılığı olmadan test edilebilir kılınmıştır:
Fonksiyon	İmza	Görevi
isTaskInBacklog	(statuses: SprintStatus[]) => boolean	Görevin aktif/taslak sprinti yoksa true döner.
canMoveTaskToSprint	(sprint) => { allowed, reason? }	Hedef sprintin COMPLETED olup olmadığını denetler.
canDeleteSprintTaskLink	(status: SprintStatus) => boolean	Yalnızca COMPLETED olmayan sprint bağlantılarının silinmesine izin verir.
getRemovableSprintIds	(links) => string[]	Silinebilir aktif/taslak sprint ID listesini süzer.
sortActiveDraftSprints	(sprints) => sortedSprints	ACTIVE sprinti başa, DRAFT sprintleri ardına sıralar; COMPLETED olanları eler.

6. Test Kapsamı ve Senaryoları (backlog-logic.test.ts)
src/lib/__tests__/backlog-logic.test.ts dosyasında toplam 23 adet Vitest testi bulunmaktadır:
	1. isTaskInBacklog Senaryoları (6 test):
		○ Boş sprint listesinde true dönme.
		○ Yalnızca COMPLETED sprint varken true dönme.
		○ Birden fazla COMPLETED sprint varken true dönme.
		○ ACTIVE sprinte bağlıyken false dönme.
		○ DRAFT sprinte bağlıyken false dönme.
		○ COMPLETED ve ACTIVE karışık olduğunda false dönme.
	2. canMoveTaskToSprint Senaryoları (5 test):
		○ null veya undefined sprint durumunda reddetme.
		○ COMPLETED sprinte taşımayı engelleme ve açıklayıcı Türkçe hata mesajı üretme.
		○ ACTIVE ve DRAFT sprintlere taşımaya izin verme.
	3. canDeleteSprintTaskLink Senaryoları (3 test):
		○ COMPLETED durumunda false dönme.
		○ ACTIVE ve DRAFT durumunda true dönme.
	4. getRemovableSprintIds Senaryoları (3 test):
		○ Karışık sprint listesinden yalnızca ACTIVE ve DRAFT ID'lerini filtreleme.
		○ Tüm bağlantılar COMPLETED ise boş dizi dönerek geçmişi koruma.
	5. sortActiveDraftSprints Senaryoları (3 test):
		○ COMPLETED sprintleri listeden çıkarma.
		○ ACTIVE sprinti DRAFT sprintlerin önüne yerleştirme.
	6. getSprintProgress Entegrasyon Senaryoları (3 test):
		○ 0 görevli sprintte division-by-zero engelleme (percentage: 0).
		○ Tüm görevler DONE olduğunda %100 dönme.
		○ Küsurlu oranlarda (1/3) tam sayıya yuvarlama (%33).

7. Doğrulama ve Sistem Durumu
Faz 3.03 uygulaması tamamlandıktan sonra yapılan kontroller:
	• Vitest Testleri: 17 test dosyasında 291 testin tamamı %100 başarılı olarak geçti.
	• TypeScript Tip Denetimi: npx tsc --noEmit sıfır hata ile tamamlandı.
	• Production Build: npm run build ile /projects/[projectId]/backlog rotası başarıyla derlendi ve statik/dinamik optimizasyonlar sağlandı.
	• Git Commit: 02271ea feat: (Faz 3.03) add backlog view, sprint task movement, progress bars and tests olarak sürümlendi.

8. Özet ve Kullanıcıya Sağlanan Değer
Faz 3.03 ile Pulse; görevlerin henüz sprint planına dahil edilmeden önce toplandığı, önceliklendirildiği ve tek tıkla aktif/taslak sprintlere aktarılabildiği eksiksiz bir Scrum & Kanban Planlama Deneyimi kazanmıştır. Geçmiş sprint verilerinin mimari olarak kilitlenmesi ise projede metrik güvenliğini garanti altına almıştır.
