# Faz 4.01 — Gerçekçi Analitik Veri Seti ve Tohumlama Mimarisi: Teknik Rapor & ADR-024

Bu teknik rapor ve mimari karar kaydı (ADR-024), Pulse projesinin yaklaşan analitik ve raporlama yeteneklerinin (Velocity Chart, Burndown Chart, Lead/Cycle Time, Workload Heatmap) ihtiyaç duyduğu ilişkisel, zengin ve tarihsel derinliğe sahip mock veri ekosisteminin mimarisini, deterministik PRNG motorunu ve test stratejisini belgeler.

---

## 1. Bağlam ve Problem Tanımı

### 1.1 Problem
- **Boş veya Yetersiz Görünümler:** Önceki aşamalarda veritabanında yalnızca birkaç test görevi ve 1 demo proje bulunuyordu. Bu durum Kanban, Backlog ve özellikle Dashboard analitik ekranlarının (Sprint Hızı, Burndown, Son Aktiviteler) boş veya anlamsız görünmesine yol açıyordu.
- **Rastgele Veri Riski (Unrealistic Mock Data):** Anlamsız "lorem ipsum" metinleri veya rastgele tarihlerle üretilen veriler, yazılım takımlarının gerçek iş akışlarını yansıtamaz; Lead Time (görev oluşturma -> tamamlama) ve Cycle Time (başlama -> tamamlama) hesaplamalarında tutarsızlıklara yol açar.
- **Döngüsel Bağımlılık ve Kural İhlali Riski:** Görev ilişkileri rastgele bağlandığında döngüsel engellemeler (`BLOCKS` cycle) oluşabilir veya tek aktif sprint kısıtı ihlal edilebilirdi.

### 1.2 Hedefler
1. **İlişkisel ve Hikayeli Veri:** 10 gerçekçi kullanıcı personası (Product Owner, Scrum Master, EM, Backend, Frontend, QA, DevOps), 5 ana proje ve 500 anlamlı yazılım görevi.
2. **Deterministik Tohumlama (Reproducible PRNG):** Rastgelelik yerine `mulberry32` algoritması kullanılarak her çalıştırmada %100 aynı, öngörülebilir veri kümesinin üretilmesi.
3. **Tarihsel Derinlik:** 1 Ocak - 20 Mayıs arasına yayılan 10 sprintlik periyot ve görev yaşam döngüsüne uygun 3.000 aktivite kaydı.
4. **Mevcut Mimariye Tam Uyum:** Döngü tespiti için `src/lib/relation-logic.ts` içindeki `wouldCreateBlockCycle` ve `hasExistingRelation` saf fonksiyonlarının doğrudan yeniden kullanılması; Backlog kuralının (`isTaskInBacklog`) korunması.

---

## 2. Mimari Kararlar ve Bileşen Yapısı

### 2.1 İki Katmanlı Tohumlama Yapısı

```
prisma/
├── seed-data-generators.ts   (typescript-pro: Saf, DB bağımsız jeneratörler & PRNG)
├── seed-realistic-data.ts    (postgres-pro: Prisma orkestrasyonu, temizlik & toplu ekleme)
└── tsconfig.seed.json        (Cross-platform ts-node derleme yapılandırması)
```

1. **`seed-data-generators.ts` (Saf Domain Katmanı):**
   - **`createSeededRng(seed: number)`:** `mulberry32` tabanlı sözde rastgele sayı üreteci (`int`, `float`, `pick`, `pickWeighted`, `shuffle`, `bool`).
   - **Şablonlar:** 10 kullanıcı (`SEED_USERS`), 5 proje (`SEED_PROJECTS`), 8 Kanban durumu (`SEED_STATE_TEMPLATES`), 30 etiket (`SEED_LABEL_TEMPLATES`).
   - **Ağırlıklı Seçiciler:** Görev tipleri (%60 Feature, %15 Bug, %10 Improvement, %5 Research, %5 Spike, %5 Documentation), Öncelikler (%35 Medium, %25 Low, %20 High, %10 Urgent, %10 None).
   - **Zengin İçerik:** GFM Markdown checklist'leri (`- [x]`, `- [ ]`) yaklaşık %40 göreve, ek dosya simülasyonları (`📎 [attachment.png]`) yaklaşık %30 göreve eklenir.

2. **`seed-realistic-data.ts` (Veritabanı Orkestrasyon Katmanı):**
   - **Idempotent Temizlik:** Seed kullanıcılarına ait veriler silinerek baştan temiz kurulum yapılır.
   - **Toplu Ekleme:** `createMany` kullanılarak 500 görev, 1.000 yorum ve 3.000 aktivite tek seferde, yüksek performansla yazılır (~5 saniye).
   - **Kural Denetimli İlişkiler:** `BLOCKS` ilişkileri atanırken `wouldCreateBlockCycle` çağrılarak grafikte döngü oluşumu engellenir.
   - **Backlog İnvaryantı:** 120 adet Backlog görevi hiçbir `ACTIVE` veya `DRAFT` sprint'e atanmaz.

3. **`tsconfig.seed.json` (Platform Bağımsızlığı):**
   - Windows `cmd.exe` ortamında `--compiler-options {"module":"CommonJS"}` inline JSON komutlarının tırnak soyulması (quote-stripping) nedeniyle hata vermesini önlemek amacıyla ayrı bir `prisma/tsconfig.seed.json` dosyası tanımlanmıştır.
   - `package.json` içerisine `"db:seed-rich": "ts-node --project prisma/tsconfig.seed.json prisma/seed-realistic-data.ts"` komutu eklenmiştir.

---

## 3. Doğrulanan Veri Hacmi ve Metrikler

| Varlık | Hedef | Gerçekleşen | Mimari Uyum |
|---|---|---|---|
| **Users** | 10 | 10 | 1 ADMIN (`Ahmet Yılmaz`), 9 MEMBER. Şifreler `password123`. |
| **Projects** | 5 | 5 | `CORE` (120), `ANL` (100), `AI` (90), `ADM` (110), `MOB` (80) = 500 Görev. |
| **States** | 40 | 40 | 8 durum x 5 proje (Backlog, Ready, In Progress, Code Review, Testing, Blocked, Done, Cancelled). |
| **Labels** | 150 | 150 | 30 etiket x 5 proje (Frontend, Backend, DevOps, Process, AI alanları). |
| **Sprints** | 50 | 50 | Her projede 8 COMPLETED, 1 ACTIVE, 1 DRAFT (Tek aktif sprint kısıtı korundu). |
| **Tasks** | 500 | 500 | 120 Backlog, 60 Ready, 70 In Progress, 40 Code Review, 50 Testing, 20 Blocked, 130 Done, 10 Cancelled. |
| **Comments** | 1.000 | 1.000 | Proje üyeleri arasında geçen gerçekçi mühendislik tartışmaları. |
| **Activities** | 3.000 | 3.000 | 500 CREATED, 900 STATE_CHANGED, 250 ASSIGNEE, 150 PRIORITY, 700 COMMENT, 200 LABEL, 200 SPRINT, 100 RELATION. |
| **TaskRelations** | 100 | 100 | 20 BLOCKS (Blocked görevler için), 47 RELATES_TO, 33 DUPLICATES (döngüsüz). |

---

## 4. Test Stratejisi (Antigravity QA)

- **Test Dosyası:** `src/lib/__tests__/seed-data-generators.test.ts`
- **Yeni Test Sayısı:** 17 test
- **Toplam Test Durumu:** 19 test süiti, **348 test (%100 Başarılı)**
- **Kapsam:**
  - `createSeededRng` determinizmi, sınır değerleri ve ağırlıklı seçim doğruluğu.
  - `SEED_USERS` ve `SEED_PROJECTS` varlık bütünlüğü ve toplam 500 görev eşleşmesi.
  - `SEED_STATE_TEMPLATES` 8 durum sırası ve `StateGroup` eşleşmeleri.
  - `SEED_LABEL_TEMPLATES` 30 benzersiz etiket ve alan dağılımı.
  - `generateTaskTitle`, `generateTaskDescription`, `generateCommentContent` format denetimleri.
  - `buildSprintWindows` 10 sprint x 14 gün zaman aralıkları ve çakışmasızlık garantisi.
  - `TASK_TYPE_WEIGHTS` ve `PRIORITY_WEIGHTS` 100 toplam ağırlık doğrulaması.

---

## 5. Sonuç ve Gelecek Faz Entegrasyonu

Bu tohumlama veri seti sayesinde:
1. Faz 4 kapsamında inşa edilecek **Velocity Chart**, **Burndown Chart**, **Lead Time & Cycle Time Metrikleri** ve **Workload Heatmap** bileşenleri canlı ve zengin verilerle anında doğrulanabilecektir.
2. `npm run db:seed-rich` komutu geliştirme ortamında tek adımda temiz, ilişkisel ve hatasız bir çalışma alanı sunmaktadır.
