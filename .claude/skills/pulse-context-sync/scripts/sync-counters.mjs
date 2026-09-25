#!/usr/bin/env node
// Deterministic counter sync for Pulse context docs.
// Only replaces digits inside known counter phrases — never rewrites prose.
//
// Usage:
//   node .claude/skills/pulse-context-sync/scripts/sync-counters.mjs            # dry-run (default)
//   node .claude/skills/pulse-context-sync/scripts/sync-counters.mjs --write    # apply changes
//   node .claude/skills/pulse-context-sync/scripts/sync-counters.mjs --check    # exit 1 on drift (CI)
//   add --static to count tests by regex instead of running vitest (cannot expand it.each)

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../../..");
const TESTS_DIR = join(ROOT, "src/lib/__tests__");
const SCHEMA = join(ROOT, "prisma/schema.prisma");
// Only living documents. Numbered docs/ai-context/NNN-*.md snapshots are historical and never touched.
const TARGETS = ["AGENTS.md", "context.md", "docs/ai-context/system-overview.md"];

const args = new Set(process.argv.slice(2));
const WRITE = args.has("--write");
const CHECK = args.has("--check");
const STATIC = args.has("--static");

// ---------- Collect ground truth ----------

function countTestsWithVitest() {
  const dir = mkdtempSync(join(tmpdir(), "pulse-sync-"));
  const out = join(dir, "vitest.json");
  try {
    try {
      execSync(`npx vitest run --reporter=json --outputFile="${out}"`, { cwd: ROOT, stdio: "ignore" });
    } catch {
      // Non-zero exit on failing tests; the JSON report is still written.
    }
    if (!existsSync(out)) throw new Error("vitest did not produce a JSON report");
    const report = JSON.parse(readFileSync(out, "utf8"));
    const suites = new Map();
    for (const r of report.testResults) suites.set(basename(r.name), r.assertionResults.length);
    return { suites, total: report.numTotalTests, failed: report.numFailedTests + report.numFailedTestSuites };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function countTestsStatically() {
  const suites = new Map();
  for (const f of readdirSync(TESTS_DIR).filter((f) => f.endsWith(".test.ts")).sort()) {
    const src = readFileSync(join(TESTS_DIR, f), "utf8");
    const n = (src.match(/^\s*(?:it|test)(?:\.(?:only|skip|todo|concurrent))?\s*\(/gm) ?? []).length;
    suites.set(f, n);
  }
  const total = [...suites.values()].reduce((a, b) => a + b, 0);
  return { suites, total, failed: 0 };
}

function readSchema() {
  const src = readFileSync(SCHEMA, "utf8");
  const models = (src.match(/^model\s+\w+\s*\{/gm) ?? []).length;
  const enums = new Map();
  for (const m of src.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const values = m[2]
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, "").trim())
      .filter((l) => l && !l.startsWith("@@"));
    enums.set(m[1], values.length);
  }
  return { models, enums };
}

const tests = STATIC ? countTestsStatically() : countTestsWithVitest();
const schema = readSchema();
const suiteCount = tests.suites.size;

if (tests.failed && WRITE) {
  console.error(`Refusing to write: ${tests.failed} failing test(s). Counters claim "100% passing" — fix failures first.`);
  process.exit(2);
}

// ---------- Replacement rules (digits only) ----------
// Each rule: regex with exactly one or two numeric capture groups named n / n2, and the value(s) to write.

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const rules = [
  { name: "models", re: /(?<n>\d+)(?= Models across)/g, value: schema.models },
  { name: "models", re: /(?<=Database Models \()(?<n>\d+)(?=\))/g, value: schema.models },
  { name: "enums", re: /(?<=\bEnums \()(?<n>\d+)(?=\))/g, value: schema.enums.size },
  { name: "tests total", re: /(?<n>\d+)(?= tests across \d+ suites)/gi, value: tests.total },
  { name: "suites", re: /(?<=\d+ tests across )(?<n>\d+)(?= suites)/gi, value: suiteCount },
  { name: "tests total", re: /(?<n>\d+)(?= tests passing across \d+ test suites)/g, value: tests.total },
  { name: "suites", re: /(?<=tests passing across )(?<n>\d+)(?= test suites)/g, value: suiteCount },
  { name: "tests total", re: /(?<=Total:\**\s*\**)(?<n>\d+)(?=\s+tests\b)/g, value: tests.total },
  { name: "tests total", re: /(?<=pass 100% \()(?<n>\d+)(?= tests\))/gi, value: tests.total },
  { name: "tests total", re: /(?<n>\d+)(?= Vitest tests are passing 100%)/g, value: tests.total },
  ...[...schema.enums].map(([e, count]) => ({
    name: `enum ${e}`,
    re: new RegExp(`(?<=\\b${esc(e)}\\**\\s\\()(?<n>\\d+)(?= values)`, "g"),
    value: count,
  })),
  ...[...tests.suites].map(([file, count]) => ({
    name: `suite ${file}`,
    re: new RegExp(`(?<=\`${esc(file)}\`\\**\\s\\()(?<n>\\d+)(?=( tests)?\\))`, "g"),
    value: count,
  })),
];

// ---------- Apply ----------

const changes = [];
const warnings = [];

for (const rel of TARGETS) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) {
    warnings.push(`${rel}: file not found, skipped`);
    continue;
  }
  const original = readFileSync(path, "utf8");
  const lines = original.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const rule of rules) {
      lines[i] = lines[i].replace(rule.re, (match) => {
        if (Number(match) !== rule.value) {
          changes.push({ file: rel, line: i + 1, rule: rule.name, from: match, to: String(rule.value) });
        }
        return String(rule.value);
      });
    }
  }
  const updated = lines.join("\n");

  // Suite listings: report (never insert) suites missing from or stale in a file's per-suite list.
  const listed = new Set([...original.matchAll(/`([\w.-]+\.test\.ts)`\**\s\(\d+/g)].map((m) => m[1]));
  if (listed.size > 0) {
    const missing = [...tests.suites.keys()].filter((f) => !listed.has(f));
    const stale = [...listed].filter((f) => !tests.suites.has(f));
    if (missing.length) warnings.push(`${rel}: suites not listed (add manually): ${missing.join(", ")}`);
    if (stale.length) warnings.push(`${rel}: listed suites that no longer exist: ${stale.join(", ")}`);
  }

  if (WRITE && updated !== original) writeFileSync(path, updated, "utf8");
}

// ---------- Report ----------

const mode = WRITE ? "WRITE" : CHECK ? "CHECK" : "DRY-RUN";
console.log(`# pulse-context-sync (${mode}, tests counted via ${STATIC ? "static regex" : "vitest JSON"})`);
console.log("");
console.log("## Ground truth");
console.log(`- Tests: ${tests.total} across ${suiteCount} suites${tests.failed ? ` (${tests.failed} FAILING)` : ""}`);
console.log(`- Prisma: ${schema.models} models, ${schema.enums.size} enums`);
console.log(`- Enum values: ${[...schema.enums].map(([e, n]) => `${e}=${n}`).join(", ")}`);
console.log("");
console.log(`## Counter drift (${changes.length})`);
if (changes.length === 0) console.log("- None. All counters are in sync.");
for (const c of changes) console.log(`- ${c.file}:${c.line} [${c.rule}] ${c.from} -> ${c.to}${WRITE ? "" : " (not written)"}`);
if (warnings.length) {
  console.log("");
  console.log("## Needs manual attention");
  for (const w of warnings) console.log(`- ${w}`);
}

if (CHECK && changes.length > 0) process.exit(1);
