---
status: proposed
date: 2026-09-27
decision-makers: [Oktay]
consulted: [Antigravity, Claude Code]
informed: []
version: v0.6.6
phase-step: "Phase 6 / Step 6.07"
supersedes: []
superseded-by: null
related: [./ADR-020-global-arama-ve-komut-paleti.md, ./ADR-034-ai-agent-koordinasyon-altyapisi.md, ../spec/v0.6.6-step-6.07.md]
confidence: high
---

# ADR-035: Proje Hafızası ve pgvector Tabanlı Semantik Arama Mimarisi

## Özet (Y-Statement)

Pulse görev havuzunda artan geçmiş kayıtlar ve doğal dille bilgi arama ihtiyacı bağlamında, tam metin aramasının ("contains"/"like") eşanlamlı kelimeleri, yazım varyasyonlarını ve anlamsal ilişkileri yakalayamaması sorunu ile karşı karşıyayken;
**pgvector uzantısı ile PostgreSQL içi vektör depolama, ivfflat kosinüs indeksi, SHA-256 içerik hash'i ile idempotant embedding üretimi ve melez (hybrid: vektör + metin) sıralama** seçeneğini seçtik, harici özel vektör veritabanları (Pinecone, Qdrant, Milvus) veya saf istemci taraflı embedding hesaplama seçeneklerini değil;
böylece tek veri kaynağı (single source of truth), ACID işlem garantisi, sıfır ek altyapı maliyeti ve LLM/ağ kesintilerinde sıfır-hata fallback yeteneği sağlanır, PostgreSQL konteynerine pgvector bağımlılığı eklenmesi ve 1536 boyutlu vektörlerin disk/bellek ayak izi kabul edilerek.

## Bağlam ve Problem Tanımı (Context and Problem Statement)

Pulse v0.6.5 itibariyle 25 model, 9 enum ve 752 test içeren olgun bir çoklu-agent ve proje yönetim mimarisine sahiptir. Mevcut küresel arama mekanizması (`ADR-020`), Prisma `contains: query, mode: "insensitive"` operatörü ve görev kimliği (`PRJ-12`) ayrıştırmasına dayanmaktadır.

Bu yaklaşım kesin kelime eşleşmelerinde hızlı ve etkilidir; ancak kullanıcı doğal dille arama yaptığında (örneğin *"ödeme sistemindeki kesinti"* veya *"kullanıcı oturum hatası"*), başlık veya açıklamada birebir bu kelimeler geçmediğinde (örneğin görev adı *"Stripe webhook 500 yanıtı"* veya *"JWT auth token geçersizliği"* olduğunda) sonuç döndürememektedir. Benzer şekilde, görev detayında kullanıcıya mükerrer veya ilişkili işleri gösterebilecek otomatik bir benzerlik motoru bulunmamaktadır.

Bu yeteneği sisteme kazandırırken şu soruya yanıt aranmaktadır: Pulse'a kurumsal proje hafızası (Project Memory) ve semantik arama (RAG / Semantic Search) yeteneği, mevcut Next.js + PostgreSQL mimarisine minimum karmaşıklık ve maksimum veri tutarlılığı ile nasıl entegre edilmelidir?

## Karar Etkenleri (Decision Drivers)

- **Veri Bütünlüğü ve İlişkisel Tutarlılık:** Görevler silindiğinde (`ON DELETE CASCADE`) gömme vektörlerinin de atomik olarak temizlenmesi, yetkisiz projelerin verilerinin sızmaması (`ProjectMember` izolasyonu).
- **Altyapı Sadeligi:** Bağımsız ayrı bir vektör veritabanı (Pinecone, Weaviate, Chroma) yerine mevcut PostgreSQL 16 altyapısının korunması.
- **Sıfır Hata Dayanıklılığı (Resilience & Fallback):** Harici embedding API'si erişilemez olduğunda veya yapılandırılmadığında sistemin çökmemesi; kesintisiz olarak geleneksel metin aramasına geri düşmesi (`interpreted heuristic fallback` deseni).
- **Maliyet ve Ağ Optimizasyonu:** Görev başlığı veya açıklaması değişmediği sürece gereksiz embedding API çağrılarının önlenmesi (idempotancy via SHA-256 content hashing).
- **Test Edilebilirlik:** Saf benzerlik matematiği, hibrit birleştirme ve konfigürasyon çözümleme mantığının DB ve ağ bağımsız saf fonksiyonlar (`src/lib/semantic-search.ts`) olarak izole edilmesi.

## Değerlendirilen Seçenekler (Considered Options)

1. **pgvector Tabanlı İlişkisel Entegrasyon (Seçilen Seçenek):** PostgreSQL konteynerini `pgvector/pgvector:pg16` imajına geçirerek `TaskEmbedding` tablosunda `vector(1536)` saklamak, `ivfflat` kosinüs indeksi kullanmak, API üzerinden asenkron embedding üretip Prisma raw query (`<=>`) ile aramak ve sonuçları metin aramasıyla hibrit harmanlamak.
2. **Harici Vektör Veritabanı Servisi (Pinecone / Qdrant Cloud):** Vektörleri harici bir SaaS veya ayrı konteynerde tutmak, senkronizasyonu webhook veya kuyrukla sağlamak.
3. **Sadece PostgreSQL Trigram & Full-Text Search (tsvector / pg_trgm):** Vektör embedding kullanmaksızın PostgreSQL'in yerel metin arama ve trigram benzerlik modüllerini kullanmak.

## Karar (Decision Outcome)

Seçilen seçenek: **"pgvector Tabanlı İlişkisel Entegrasyon"**, çünkü görev verisi ile vektör verisini aynı veritabanında tutarak yabancı anahtar (`Task.id` -> `TaskEmbedding.taskId`), basamaklı silme (`CASCADE`) ve proje üyelik filtrelerini tek bir SQL sorgusunda birleştirmeye imkan verir. Ayrı bir servis yönetim yükü getirmez ve harici embedding API kesintilerinde zarif biçimde metin aramasına geri düşer.

### Temel Mimari Bileşenler:

1. **Docker Altyapısı:** `docker-compose.yml` içindeki veritabanı servisi `pgvector/pgvector:pg16` olarak güncellendi.
2. **Veri Modeli (`TaskEmbedding`):**
   - `taskId` üzerinden `@unique` ve `Task` modeline `onDelete: Cascade` ile bağlı.
   - `embedding Unsupported("vector(1536)")?` alanı OpenAI uyumlu 1536 boyutlu gömmeleri barındırır.
   - `contentHash String`: Görevin son gömülen metninin SHA-256 özeti. Başlık ve açıklama değişmemişse API çağrısı atlanır.
   - `task_embedding_cosine_idx`: `ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100)` indeksi ile hızlı yaklaşık en yakın komşu (ANN) araması.
3. **Saf Alan Mantığı (`src/lib/semantic-search.ts`):**
   - `buildTaskEmbeddingText`: Görev metnini `"[PRJ-12] Başlık\n\nAçıklama"` formatında standardize eder.
   - `computeContentHash` & `shouldRegenerateEmbedding`: İçerik özetini hesaplar ve gereksiz üretimi engeller.
   - `cosineSimilarity`: İki sayı dizisi arasında kosinüs benzerliğini hesaplar (sıfır büyüklük ve boyut uyumsuzluğu korumalı).
   - `toVectorLiteral` & `clampSimilarity`: pgvector SQL sözdizimi formatlama ve [0, 1] aralık kırpma.
   - `filterBySimilarityThreshold` (varsayılan: 0.70) ve `mergeHybridResults`: Vektör ve metin sonuçlarını sıralı ve tekilleştirilmiş olarak birleştirir.
4. **Dayanıklı Servis Katmanı (`src/lib/embedding-service.ts` & `src/lib/ai/embeddings.ts`):**
   - Görev oluşturma veya başlık/açıklama güncelleme sonrasında `upsertTaskEmbedding(taskId)` tetiklenir; hata durumunda asla ana akışı kesmez (try/catch ve console.warn).
   - API anahtarı veya endpoint tanımlı değilse sessizce `null` döner; `globalSearch` geleneksel metin sonuçlarını sunmaya devam eder.
5. **Kullanıcı Deneyimi:**
   - **Komut Paleti (`CommandPalette`):** Hem metin hem de semantik arama sonuçlarını melez olarak listeler.
   - **Görev Detayı (`SimilarTasks`):** Görev detay modalında aynı projeden %70 ve üzeri anlamsal benzerliğe sahip görevleri "Benzer Görevler" altında listeler.

### Sonuçlar (Consequences)

- **Olumlu:** Doğal dille arama yapıldığında birebir kelime eşleşmesi olmasa dahi doğru görevler ve çözümler anında bulunur.
- **Olumlu:** Görev silindiğinde veya güncellendiğinde vektör tutarlılığı ilişkisel veritabanı seviyesinde korunur; orphan vektör riski yoktur.
- **Olumlu:** SHA-256 içerik hash denetimi sayesinde gereksiz LLM/embedding maliyeti ve ağ gecikmesi tamamen önlenir.
- **Olumsuz:** PostgreSQL konteynerine `pgvector` uzantısı eklenmiştir; veritabanı imaj boyutu ve RAM tüketimi standart PostgreSQL'e göre bir miktar artmaktadır.
- **Olumsuz:** Prisma ORM yerel olarak `vector` tipini tam tip güvenliğiyle desteklemediği için vektör benzerlik sorguları `$queryRaw` ve `$executeRaw` üzerinden SQL düzeyinde yürütülmektedir.
- **Nötr:** Embedding sağlayıcısı standart env değişkenleri (`AI_EMBEDDING_ENDPOINT`, `AI_EMBEDDING_MODEL`) üzerinden yapılandırılır; yerel (Ollama/vLLM) ya da bulut (OpenAI/Together) modelleriyle tak-çalıştır uyumludur.

### Doğrulama (Confirmation)

- **Birim ve Mantık Testleri:** `src/lib/__tests__/semantic-search.test.ts` (55 test: metin üretimi, hashing, kosinüs benzerliği, vektör literali, sınır kırpma, eşik filtreleme, melez sıralama, yapılandırma çözümleme ve sıfır-hata fallback).
- **Regresyon Testleri:** `npm test` ile 38 test dosyasında 724 Vitest testinin tümünün %100 başarıyla geçmesi.
- **Agent Testleri:** `agent\.venv\Scripts\pytest` ile 83 Python testinin tümünün başarıyla geçmesi.
- **Tip Güvenliği:** `npx tsc --noEmit` ile sıfır TypeScript derleme hatası.
- **Üretim Derlemesi:** `npm run build` ile hatasız ve temiz Next.js Turbopack derlemesi.
- **Veritabanı Şeması:** `npx prisma migrate status` çıktısında tüm migrasyonların (özellikle `20260927210000_add_task_embedding_pgvector`) senkronize ve temiz doğrulanması.

## Seçeneklerin Artı ve Eksileri (Pros and Cons of the Options)

### Seçenek 1: pgvector Tabanlı İlişkisel Entegrasyon (Seçilen)

- İyi, çünkü veritabanı içinde ACID garantisi ve `ON DELETE CASCADE` ile kusursuz veri bütünlüğü sağlar.
- İyi, çünkü proje üyeliği yetkilendirmesi (`ProjectMember`) tek bir SQL `EXISTS` tümcesi ile ek ağ maliyeti olmaksızın çözülür.
- İyi, çünkü ayrı bir vektör veritabanı çalıştırma, barındırma ve lisanslama operasyonel yükü yoktur.
- Nötr, çünkü Prisma `Unsupported("vector(1536)")` alanı kullandığı için ham sorgu (`$queryRaw`) gerektirir.
- Kötü, çünkü veritabanı sunucusuna ilave vektör indeksleme (`ivfflat`) ve kosinüs mesafesi hesaplama CPU/RAM yükü bindirir.

### Seçenek 2: Harici Vektör Veritabanı Servisi (Pinecone / Qdrant)

- İyi, çünkü vektör indeksleme ve arama yükü ana veritabanından tamamen izole edilir; devasa veri setlerinde bağımsız ölçeklenebilir.
- İyi, çünkü zengin vektör arama filtreleme ve hibrit arama SDK'ları sunar.
- Nötr, çünkü yönetilen bulut servisleri bakım gerektirmez.
- Kötü, çünkü görev silme veya güncelleme durumlarında iki yönlü dağıtık tutarlılık (distributed consistency) yönetimi gerekir; ağ kopmalarında veriler senkronizasyon dışına çıkabilir.
- Kötü, çünkü Pulse'ın kendi kendine yeten yerel geliştirme (self-contained local docker-compose) ilkelerine aykırıdır; ek servis bağımlılığı veya internet bağlantısı zorunluluğu doğurur.

### Seçenek 3: Sadece PostgreSQL Trigram & Full-Text Search (tsvector / pg_trgm)

- İyi, çünkü harici hiçbir embedding API'sine veya modeline ihtiyaç duymaz; işletme maliyeti sıfırdır.
- İyi, çünkü standart PostgreSQL imajında yerel eklentilerle (`pg_trgm`) hemen çalışır.
- Nötr, çünkü kelime köklerini (stemming) PostgreSQL sözlükleriyle bulabilir.
- Kötü, çünkü anlamsal kavrayış (semantik benzerlik) sağlayamaz; *"fatura hatası"* ile *"ödeme başarısızlığı"* gibi eşanlamlı ve kavramsal ilişkileri tespit edemez.

## Ek Bilgiler (More Information)

- **Kanıt / Kaynaklar:**
  - PostgreSQL pgvector resmi dokümantasyonu: https://github.com/pgvector/pgvector
  - OpenAI Embeddings & RAG mimari rehberi: https://platform.openai.com/docs/guides/embeddings
  - Pulse ADR-020 (Global Arama ve Komut Paleti) ve ADR-034 (AI Agent Koordinasyon Altyapısı)
- **Yeniden değerlendirme tetikleyicisi:** Projedeki görev ve doküman sayısı yüz binleri aşıp `ivfflat` veya `HNSW` indekslerinin PostgreSQL bellek sınırlarını zorlaması durumunda harici ayrık vektör veritabanına geçiş tekrar değerlendirilebilir.
- **İlgili:** [ADR-020](./ADR-020-global-arama-ve-komut-paleti.md), [ADR-034](./ADR-034-ai-agent-koordinasyon-altyapisi.md), [Step 6.07 Spesifikasyonu](../spec/v0.6.6-step-6.07.md), [AI-Context: Search & RAG Memory](../../docs/ai-context/search-rag-memory.md).
