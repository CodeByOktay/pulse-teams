# Faz 3.07 — Görev İlişkileri ve Bağımlılık Mimarisi: Teknik Rapor

1. Yapılan değişiklikler
Veritabanı: RelationType enum (BLOCKS/RELATES_TO/DUPLICATES), TaskRelation modeli (@@unique([sourceTaskId, targetTaskId, type]), iki indeks, onDelete: Cascade), Task modeline sourceRelations/targetRelations ters ilişkileri, ActivityType'a 2 yeni değer.
İş mantığı (src/lib/relation-logic.ts) — tamamı saf fonksiyon:
	• getRelationLabel(type, direction) — tek yönlü kaydın iki perspektif etiketi. DB'ye ters kayıt asla yazılmaz.
	• hasExistingRelation — tek çift kuralı: yönden ve tipten bağımsız.
	• wouldCreateBlockCycle — iteratif DFS (stack + visited, rekürsiyon yok). Self-relation'ı da döngü sayar; mevcut veride döngü olsa bile visited sonsuz döngüyü keser.
	• requiresCycleCheck / collectBlockEdges — döngü kontrolü yalnızca BLOCKS kenarlarına uygulanır.
	• groupRelationsForTask — any yerine tipli SourceRelationRecord/TargetRelationRecord; taskId ile eşleşmeyen kayıtları savunmacı biçimde eler.
Server actions (src/actions/relation.ts): addTaskRelation, removeTaskRelation, searchTasksForRelation. projectId istemciden değil, doğrulanmış görev kaydından alınır; searchTasksForRelation'da gelen projectId görevin gerçek projesiyle karşılaştırılır. Mutasyonlar $transaction + logActivity içinde, ardından revalidatePath.
UI: task-relations.tsx — 4 gruplu kompakt liste (identifier rozeti, durum rengi, hover'da X ile optimistic silme + hata halinde geri alma), tip seçici ve 250 ms debounce'lu aramalı "İlişki Ekle" popover'ı (Escape ile kapanır, aria etiketli). İlişkili göreve tıklanınca modal o göreve geçer; ?task= derin bağlantısı varsa URL de güncellenir (board/list/backlog).
Modal'daki detay eşleme kodu tek bir toTaskDetail fonksiyonunda toplandı — ilişki eklendiğinde/silindiğinde reloadDetail ile sessiz tazeleme yapılıyor.
2. Oluşturulan dosyalar
src/lib/relation-logic.ts · src/actions/relation.ts · src/components/task-detail/task-relations.tsx · src/lib/__tests__/task-relations.test.ts · prisma/migrations/20260920004710_add_task_relations/migration.sql
3. Değiştirilen dosyalar
prisma/schema.prisma · src/actions/task.ts (getTaskDetail include) · src/lib/activity-logger.ts · src/components/task-detail/task-detail-modal.tsx · kanban-board.tsx · list-view-container.tsx · backlog-page-container.tsx · AGENTS.md · CONTEXT.md
4. Prisma migration
20260920004710_add_task_relations — prisma migrate dev ile üretildi ve uygulandı. SQL yalnızca CREATE TYPE, ALTER TYPE ... ADD VALUE ×2, CREATE TABLE, 3 indeks ve 2 foreign key içeriyor; hiçbir DROP/TRUNCATE yok. Doğrulama: mevcut 10 görev yerinde, TaskRelation sorgulanabilir (0 satır).
5. Eklenen testler
task-relations.test.ts — 40 test: 6 perspektif etiketi, self-relation, doğrudan/zincirleme döngü, elmas graf (D→A engellenir, B→C serbest), bağlantısız graf, mevcut döngüde sonsuz döngüye girmeme, 1000 düğümlü zincirde stack overflow koruması, tek çift kuralı (ters yön + farklı tip), 4 gruba ayrıştırma, ve yeni aktivite mesajlarının formatlanması.
6. Doğrulama sonuçları
Komut	Sonuç
npm test	✅ 18 dosya, 331/331 test geçti (291 → 331)
npx tsc --noEmit	✅ exit 0, hata yok
npm run build	✅ exit 0, 12 route derlendi
Ek olarak npm run lint çalıştırdım: depoda zaten mevcut olan 18 hata var (sequence.test.ts'te any, use-saved-views.ts/kanban-board.tsx'te react-hooks/set-state-in-effect). Yeni dosyalarım bu sayıya hiçbir şey eklemiyor — ilk yazımda popover'ın debounce effect'i bir ihlal üretiyordu, setIsSearching çağrısını timer callback'ine taşıyarak giderdim.
7. Git commit
9a7a5db — feat: (Faz 3.07) add task relations, cycle detection, relations UI and tests (15 dosya, +1344/−364)
8. Bilinen sınırlamalar
	• Prisma engine binary'si yenilenemedi. npx prisma generate çalışan next dev sunucusu query_engine-windows.dll.node dosyasını kilitlediği için EPERM verdi. TypeScript tipleri ve client JS'i tam olarak yeniden üretildi (index.d.ts içinde 618 TaskRelation referansı) ve engine sürümü değişmediği için çalışma zamanı doğrulandı. Sunucuyu durdurup yeniden generate etmeyi denedim ancak süreç sonlandırma izni reddedildi — dev sunucusunu yeniden başlatmanız gerekiyor ki yeni şema client'ı yüklensin. node_modules/.prisma/client/ altında 6 adet artık .tmp* dosyası birikmiş (her biri ~21MB, bir kısmı benden önceki denemelerden); temizlik isterseniz sunucu kapalıyken silinebilir.
	• FAZ3_PROMPTS.md silinmesi commit'e dahil oldu — bu silme ben başlamadan önce sizin tarafınızdan staged edilmişti, git add . talimatı gereği commit'e girdi.
	• Kapsam dışı bırakılanlar (kapsam gereği): ilişkiye göre kanban durum geçişi bloklama ve board kartlarında bağımlılık rozeti.
	• İlişki ekleme sırasında iki eşzamanlı istek teorik olarak yarışabilir; @@unique kısıtı aynı yön+tip için korur, ters yöndeki nadir yarış ise uygulama katmanı kontrolüne bağlı.
9. Sonraki özellikle entegrasyon noktaları
	• Faz 4 (Profil / Gelecek Fazlar): relation.ts içindeki requireMembership kalıbı aynen kullanılabilir; ilişki aktiviteleri zaten profil aktivite akışına düşer.
	• wouldCreateBlockCycle hazır: ileride "engelleyen görev tamamlanmadan DONE'a taşınamaz" kuralı için blockedBy grubu doğrudan kullanılabilir.
	• searchTasksForRelation, parseTaskIdentifier'ı Faz 3.04'den yeniden kullanıyor — komut paletine "ilişki ekle" aksiyonu eklemek kolay.
	• groupRelationsForTask çıktısı board kartı rozetleri için hazır veri sağlıyor (yalnızca sayı gerekiyorsa countGroupedRelations).
