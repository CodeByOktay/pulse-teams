// Sağlayıcıdan bağımsız gömme (embedding) üretimi. LLM config ile aynı auth felsefesini paylaşır
// (AI_API_KEY, AI_AUTH_HEADER, AI_AUTH_SCHEME, AI_TIMEOUT_MS) — ayrı bir auth namespace icat edilmez.
// Endpoint/model yalnızca AI_EMBEDDING_ENDPOINT / AI_EMBEDDING_MODEL env değişkenlerinden gelir.
// AI_EMBEDDING_DIMENSIONS (opsiyonel) tanımlıysa isteğe `dimensions` eklenir: doğal boyutu
// EMBEDDING_DIMENSIONS'tan farklı olan MRL destekli modeller içindir (ör. 4096 boyutlu qwen3-embedding-8b).

const DEFAULT_AUTH_HEADER = "Authorization";
const DEFAULT_AUTH_SCHEME = "Bearer";
const DEFAULT_TIMEOUT_MS = 8000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 60000;

export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  authHeader: string;
  authScheme: string;
  timeoutMs: number;
  /** Sağlayıcıdan istenen vektör boyutu; yalnızca AI_EMBEDDING_DIMENSIONS tanımlıysa bulunur. */
  dimensions?: number;
}

function isPlaceholder(value: string): boolean {
  const v = value.trim();
  return v === "" || v.startsWith("<") || v.toLowerCase().startsWith("your-") || v === "CHANGE_ME";
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return isPlaceholder(value) ? undefined : value.trim();
}

function readEnvScheme(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value.trim().toLowerCase() === "none" ? "" : value.trim();
}

function readTimeout(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n) || value === "") return undefined;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(n)));
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Saf yapılandırma çözümleyici (fs/process erişimi yok). endpoint veya model tanımsızsa
 * (boş / yer tutucu) ya da endpoint geçersiz bir http(s) URL değilse null döner: "yapılandırılmamış"
 * anlamına gelir. apiKey yalnızca env'den okunur.
 */
export function resolveEmbeddingConfig(env: Record<string, string | undefined>): EmbeddingConfig | null {
  const endpoint = readString(env.AI_EMBEDDING_ENDPOINT) ?? "";
  const model = readString(env.AI_EMBEDDING_MODEL) ?? "";
  if (endpoint === "" || model === "" || !isHttpUrl(endpoint)) {
    return null;
  }

  const config: EmbeddingConfig = {
    endpoint,
    apiKey: readString(env.AI_API_KEY) ?? "",
    model,
    authHeader: readString(env.AI_AUTH_HEADER) ?? DEFAULT_AUTH_HEADER,
    authScheme: readEnvScheme(env.AI_AUTH_SCHEME) ?? DEFAULT_AUTH_SCHEME,
    timeoutMs: readTimeout(env.AI_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS,
  };
  const dimensions = Number(readString(env.AI_EMBEDDING_DIMENSIONS));
  if (Number.isInteger(dimensions) && dimensions > 0) {
    config.dimensions = dimensions;
  }
  return config;
}

/** process.env'den yapılandırmayı yükler. Saf değildir, doğrudan test edilmez. */
export function loadEmbeddingConfig(): EmbeddingConfig | null {
  return resolveEmbeddingConfig(process.env);
}

function buildHeaders(config: EmbeddingConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey !== "") {
    headers[config.authHeader] = config.authScheme === "" ? config.apiKey : `${config.authScheme} ${config.apiKey}`;
  }
  return headers;
}

function extractEmbedding(payload: unknown): number[] | null {
  const first = (payload as { data?: unknown[] } | null)?.data?.[0] as { embedding?: unknown } | undefined;
  const embedding = first?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    return null;
  }
  if (!embedding.every((n) => typeof n === "number" && Number.isFinite(n))) {
    return null;
  }
  return embedding as number[];
}

/**
 * Verilen metin için gömme vektörü üretir. ASLA hata fırlatmaz: yapılandırma eksikse, ağ hatası
 * oluşursa, yanıt 2xx değilse veya gövde beklenen şekilde değilse null döner. Bu, projenin
 * "sıfır-hata heuristic fallback" desenini yansıtır (bkz. src/lib/ai/interpreter.ts).
 */
export async function getEmbedding(text: string, config?: EmbeddingConfig | null): Promise<number[] | null> {
  try {
    const resolved = config === undefined ? loadEmbeddingConfig() : config;
    if (!resolved) return null;

    const response = await fetch(resolved.endpoint, {
      method: "POST",
      headers: buildHeaders(resolved),
      body: JSON.stringify(
        resolved.dimensions === undefined
          ? { model: resolved.model, input: text }
          : { model: resolved.model, input: text, dimensions: resolved.dimensions },
      ),
      signal: AbortSignal.timeout(resolved.timeoutMs),
    });

    // Yanıt gövdesi asla hata mesajına/loga eklenmez (gizli veri sızıntısını önlemek için).
    if (!response.ok) {
      return null;
    }

    return extractEmbedding(await response.json());
  } catch {
    return null;
  }
}
