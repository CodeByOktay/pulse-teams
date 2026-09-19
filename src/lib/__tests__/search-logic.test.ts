import { describe, it, expect } from "vitest";
import {
  normalizeSearchQuery,
  isQueryValid,
  parseTaskIdentifier,
  matchesQuery,
  filterQuickNavCommands,
  moveActiveIndex,
  flattenSearchResults,
  countTotalResults,
  hasNoResults,
} from "../search-logic";

describe("normalizeSearchQuery", () => {
  it("baştaki ve sondaki boşlukları kırpar", () => {
    expect(normalizeSearchQuery("  login  ")).toBe("login");
  });

  it("küçük harfe çevirir", () => {
    expect(normalizeSearchQuery("PRJ-12")).toBe("prj-12");
  });
});

describe("isQueryValid", () => {
  it("2 karakterden kısa sorguları geçersiz sayar", () => {
    expect(isQueryValid("a")).toBe(false);
  });

  it("boş/whitespace sorguyu geçersiz sayar", () => {
    expect(isQueryValid("   ")).toBe(false);
  });

  it("2 karakter ve üzeri sorguları geçerli sayar", () => {
    expect(isQueryValid("ab")).toBe(true);
  });
});

describe("parseTaskIdentifier", () => {
  it("PRJ-12 formatını ayrıştırır", () => {
    expect(parseTaskIdentifier("PRJ-12")).toEqual({ projectIdentifier: "PRJ", sequenceId: 12 });
  });

  it("küçük harfli identifier'ı büyük harfe çevirir", () => {
    expect(parseTaskIdentifier("prj-4")).toEqual({ projectIdentifier: "PRJ", sequenceId: 4 });
  });

  it("tire içermeyen sorguda null döner", () => {
    expect(parseTaskIdentifier("login hatası")).toBeNull();
  });

  it("sayısal olmayan kısımda null döner", () => {
    expect(parseTaskIdentifier("PRJ-abc")).toBeNull();
  });
});

describe("matchesQuery", () => {
  it("büyük/küçük harf duyarsız alt dize eşleşmesi yapar", () => {
    expect(matchesQuery("Login Hatası Düzeltildi", "hatası")).toBe(true);
  });

  it("eşleşmeyen sorguda false döner", () => {
    expect(matchesQuery("Login Hatası", "ödeme")).toBe(false);
  });

  it("boş sorguda false döner", () => {
    expect(matchesQuery("Login Hatası", "")).toBe(false);
  });
});

describe("filterQuickNavCommands", () => {
  it("boş sorguda hiçbir komut döndürmez", () => {
    expect(filterQuickNavCommands("")).toEqual([]);
  });

  it("etiketi eşleşen komutları döner", () => {
    const results = filterQuickNavCommands("board");
    expect(results.map((r) => r.id)).toEqual(["goto-board"]);
  });

  it("eşleşmeyen sorguda boş dizi döner", () => {
    expect(filterQuickNavCommands("zzz")).toEqual([]);
  });
});

describe("moveActiveIndex", () => {
  it("boş listede -1 döner", () => {
    expect(moveActiveIndex(0, "down", 0)).toBe(-1);
  });

  it("aşağı yönde bir sonraki indekse geçer", () => {
    expect(moveActiveIndex(0, "down", 3)).toBe(1);
  });

  it("aşağı yönde son elemandan ilk elemana döner (cycle)", () => {
    expect(moveActiveIndex(2, "down", 3)).toBe(0);
  });

  it("yukarı yönde bir önceki indekse geçer", () => {
    expect(moveActiveIndex(2, "up", 3)).toBe(1);
  });

  it("yukarı yönde ilk elemandan son elemana döner (cycle)", () => {
    expect(moveActiveIndex(0, "up", 3)).toBe(2);
  });
});

describe("flattenSearchResults / countTotalResults / hasNoResults", () => {
  const groups = [
    { key: "projects", label: "Projeler", items: ["p1", "p2"] },
    { key: "tasks", label: "Görevler", items: ["t1"] },
  ];

  it("flattenSearchResults tüm grupları tek diziye indirger", () => {
    expect(flattenSearchResults(groups)).toEqual(["p1", "p2", "t1"]);
  });

  it("countTotalResults toplam eleman sayısını döner", () => {
    expect(countTotalResults(groups)).toBe(3);
  });

  it("hasNoResults dolu gruplarda false döner", () => {
    expect(hasNoResults(groups)).toBe(false);
  });

  it("hasNoResults tüm gruplar boşsa true döner", () => {
    expect(hasNoResults([{ key: "projects", label: "Projeler", items: [] }])).toBe(true);
  });
});
