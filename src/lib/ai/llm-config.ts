import fs from "node:fs";
import path from "node:path";
import type { LlmConfig } from "@/lib/ai/llm-types";

// Yalnızca sağlayıcıdan bağımsız, nötr varsayılanlar. Endpoint/model/anahtar env veya config dosyasından gelir.
const DEFAULT_PROVIDER = "openai-compatible";
const DEFAULT_API_VERSION_PARAM = "api-version";
const DEFAULT_AUTH_HEADER = "Authorization";
const DEFAULT_AUTH_SCHEME = "Bearer";
const DEFAULT_TIMEOUT_MS = 8000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 60000;

type Source = Record<string, unknown>;

function isPlaceholder(value: string): boolean {
  const v = value.trim();
  return v === "" || v.startsWith("<") || v.toLowerCase().startsWith("your-") || v === "CHANGE_ME";
}

/** Boş/yer tutucu değerleri "yok" sayar; aksi halde kırpılmış string döndürür. */
function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return isPlaceholder(value) ? undefined : value.trim();
}

/** Config dosyasında boş string anlamlıdır (ham anahtar, şemasız). */
function readFileScheme(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

/** Env'de boş değer "tanımsız" demektir; ham anahtar göndermek için "none" kullanılır. */
function readEnvScheme(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value.trim().toLowerCase() === "none" ? "" : value.trim();
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "string") {
    if (value.trim() === "") return undefined;
    try {
      const parsed: unknown = JSON.parse(value);
      return readObject(parsed);
    } catch {
      return undefined;
    }
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function readHeaders(value: unknown): Record<string, string> | undefined {
  const obj = readObject(value);
  if (!obj) return undefined;
  const headers: Record<string, string> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string") headers[key] = val;
  }
  return headers;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "false" || v === "0") return false;
    if (v === "true" || v === "1") return true;
  }
  return undefined;
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
 * Saf yapılandırma çözümleyici (fs/process erişimi yok). Env değerleri dosya değerlerini ezer.
 * endpoint veya model tanımsızsa (boş / yer tutucu) ya da endpoint geçersizse null döner:
 * "AI yapılandırılmamış" anlamına gelir. apiKey yalnızca env'den okunur.
 */
export function resolveLlmConfig(
  env: Record<string, string | undefined>,
  fileConfig: Partial<Record<string, unknown>> = {},
): LlmConfig | null {
  const file: Source = fileConfig ?? {};

  const endpoint = readString(env.AI_ENDPOINT) ?? readString(file.endpoint) ?? "";
  const model = readString(env.AI_MODEL) ?? readString(file.model) ?? "";
  if (endpoint === "" || model === "" || !isHttpUrl(endpoint)) {
    return null;
  }

  return {
    provider: readString(env.AI_PROVIDER) ?? readString(file.provider) ?? DEFAULT_PROVIDER,
    endpoint,
    apiKey: readString(env.AI_API_KEY) ?? "",
    model,
    apiVersion: readString(env.AI_API_VERSION) ?? readString(file.apiVersion) ?? "",
    apiVersionParam:
      readString(env.AI_API_VERSION_PARAM) ?? readString(file.apiVersionParam) ?? DEFAULT_API_VERSION_PARAM,
    authHeader: readString(env.AI_AUTH_HEADER) ?? readString(file.authHeader) ?? DEFAULT_AUTH_HEADER,
    // Boş scheme (env: "none", dosya: "") şemasız ham anahtar gönderir.
    authScheme: readEnvScheme(env.AI_AUTH_SCHEME) ?? readFileScheme(file.authScheme) ?? DEFAULT_AUTH_SCHEME,
    extraHeaders: readHeaders(env.AI_EXTRA_HEADERS) ?? readHeaders(file.extraHeaders) ?? {},
    providerOptions: readObject(env.AI_PROVIDER_OPTIONS) ?? readObject(file.providerOptions) ?? {},
    jsonMode: readBoolean(env.AI_JSON_MODE) ?? readBoolean(file.jsonMode) ?? true,
    timeoutMs: readTimeout(env.AI_TIMEOUT_MS) ?? readTimeout(file.timeoutMs) ?? DEFAULT_TIMEOUT_MS,
  };
}

function readConfigFile(): Partial<Record<string, unknown>> {
  try {
    const configured = process.env.AI_CONFIG_PATH?.trim();
    const filePath = configured ? path.resolve(configured) : path.join(process.cwd(), "ai.config.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Dosya yok / okunamıyor / geçersiz: yok sayılır.
  }
  return {};
}

/** process.env ve opsiyonel ai.config.json dosyasından yapılandırmayı yükler. */
export function loadLlmConfig(): LlmConfig | null {
  return resolveLlmConfig(process.env, readConfigFile());
}
