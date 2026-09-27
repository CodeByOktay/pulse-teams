import { createHash } from "node:crypto";

// Saf mantık: I/O yok, Prisma importu yok. Project Memory & RAG semantik arama için kullanılan
// gömme metni oluşturma, içerik hash'i, kosinüs benzerliği ve melez (hybrid) sıralama yardımcıları.

export const SIMILARITY_THRESHOLD = 0.7;

/**
 * Bir görev için gömülecek metni oluşturur. Biçim: "[PRJ-12] Başlık\n\nAçıklama metni"
 * (kimlik biçimi projectIdentifier + sequenceId ile PRJ-12 formatına uyar, bkz.
 * src/lib/search-logic.ts içindeki parseTaskIdentifier). Açıklama null/undefined/boşsa,
 * boş-satır+açıklama kısmı tamamen atlanır (sondan boşluk kalmaz).
 */
export function buildTaskEmbeddingText(task: {
  title: string;
  description?: string | null;
  sequenceId: number;
  projectIdentifier: string;
}): string {
  const identifier = `${task.projectIdentifier}-${task.sequenceId}`;
  const header = `[${identifier}] ${task.title}`;
  const description = task.description?.trim();
  if (!description) {
    return header;
  }
  return `${header}\n\n${description}`;
}

/**
 * Verilen metnin SHA-256 hex özeti. Bir görevin gömülebilir metninin son gömme üretiminden bu yana
 * değişip değişmediğini tespit etmek için kullanılır (gereksiz API çağrılarından kaçınmak amacıyla).
 */
export function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * contentHash üretiminin gerekip gerekmediğini belirler: existingHash null/undefined ise, YA DA
 * computeContentHash(newText)'e eşit değilse true döner.
 */
export function shouldRegenerateEmbedding(existingHash: string | null | undefined, newText: string): boolean {
  if (existingHash === null || existingHash === undefined) return true;
  return existingHash !== computeContentHash(newText);
}

/**
 * İki eşit uzunluklu vektör arasındaki standart kosinüs benzerliği, [-1, 1] aralığında döner.
 * Uzunluklar farklıysa veya vektörlerden biri sıfır büyüklükteyse 0 döner (sıfıra bölmeyi/NaN'ı önler).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Bir sayı dizisini ham SQL için pgvector literaline dönüştürür, örn. "[0.1,0.2,0.3]".
 * $executeRawUnsafe sorguları oluştururken kullanılır (Prisma vektör dizilerini parametre olarak
 * doğrudan bağlayamaz).
 */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Bir benzerlik skorunu [0, 1] aralığına sıkıştırır (SQL'deki "1 - (a <=> b)" kosinüs-mesafe
 * hesaplamasından kaynaklanan, ara sıra aralığın biraz dışına düşebilen kayan nokta sapmasına karşı).
 */
export function clampSimilarity(score: number): number {
  return Math.min(1, Math.max(0, score));
}

/**
 * Öğeleri similarity >= threshold (varsayılan SIMILARITY_THRESHOLD) olanlarla filtreler,
 * girdi sırasını korur.
 */
export function filterBySimilarityThreshold<T extends { similarity: number }>(
  items: T[],
  threshold: number = SIMILARITY_THRESHOLD,
): T[] {
  return items.filter((item) => item.similarity >= threshold);
}

/**
 * Melez sıralama: vektör-benzerlik sonuçlarını ve düz metin-eşleşme sonuçlarını tek, tekrarsız bir
 * listede birleştirir, şu sırayla: (1) vectorResults içinde bulunan ve similarity >= threshold olan
 * öğeler, benzerliğe göre azalan sırada, (2) henüz dahil edilmemiş kalan textResults, orijinal
 * sıralarında. Tekilleştirme anahtarı `id`. Hiçbir girdi dizisi mutasyona uğratılmaz.
 */
export function mergeHybridResults<T extends { id: string }>(
  textResults: T[],
  vectorResults: (T & { similarity: number })[],
  threshold: number = SIMILARITY_THRESHOLD,
): T[] {
  const qualifiedVectorResults = filterBySimilarityThreshold(vectorResults, threshold)
    .slice()
    .sort((a, b) => b.similarity - a.similarity);

  const seen = new Set<string>();
  const merged: T[] = [];

  for (const item of qualifiedVectorResults) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  for (const item of textResults) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  return merged;
}
