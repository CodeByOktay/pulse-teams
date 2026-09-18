import { describe, it, expect } from "vitest";
import {
  toggleItem,
  selectAll,
  isAllSelected,
  validateBulkDeleteLimit,
  validateBulkUpdateLimit,
} from "../bulk-selection-logic";

describe("toggleItem", () => {
  it("boş Set'e id ekler", () => {
    const result = toggleItem(new Set(), "a");
    expect(result.has("a")).toBe(true);
    expect(result.size).toBe(1);
  });

  it("dolu Set'te var olan id'yi çıkarır", () => {
    const result = toggleItem(new Set(["a", "b"]), "a");
    expect(result.has("a")).toBe(false);
    expect(result.has("b")).toBe(true);
  });

  it("dolu Set'te var olmayan id'yi ekler", () => {
    const result = toggleItem(new Set(["a"]), "b");
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(true);
  });

  it("orijinal Set'i mutate etmez", () => {
    const original = new Set(["a"]);
    const result = toggleItem(original, "b");
    expect(original.has("b")).toBe(false);
    expect(result).not.toBe(original);
  });
});

describe("selectAll", () => {
  it("3 item için 3 elemanlı Set döner", () => {
    const result = selectAll([{ id: "1" }, { id: "2" }, { id: "3" }]);
    expect(result.size).toBe(3);
    expect([...result]).toEqual(["1", "2", "3"]);
  });

  it("boş array için boş Set döner", () => {
    const result = selectAll([]);
    expect(result.size).toBe(0);
  });
});

describe("isAllSelected", () => {
  it("tüm item'lar seçiliyse true döner", () => {
    const result = isAllSelected(new Set(["1", "2"]), [{ id: "1" }, { id: "2" }]);
    expect(result).toBe(true);
  });

  it("bir item eksikse false döner", () => {
    const result = isAllSelected(new Set(["1"]), [{ id: "1" }, { id: "2" }]);
    expect(result).toBe(false);
  });

  it("items boşsa false döner", () => {
    const result = isAllSelected(new Set(), []);
    expect(result).toBe(false);
  });

  it("selectedIds boşken items doluysa false döner", () => {
    const result = isAllSelected(new Set(), [{ id: "1" }]);
    expect(result).toBe(false);
  });
});

describe("validateBulkDeleteLimit", () => {
  it("count 0 ise hata döner", () => {
    const result = validateBulkDeleteLimit(0);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("En az bir görev seçilmelidir.");
  });

  it("count 1 ise geçerlidir", () => {
    expect(validateBulkDeleteLimit(1)).toEqual({ valid: true });
  });

  it("count 50 ise geçerlidir", () => {
    expect(validateBulkDeleteLimit(50)).toEqual({ valid: true });
  });

  it("count 51 ise hata döner", () => {
    const result = validateBulkDeleteLimit(51);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Aynı anda en fazla 50 görev silinebilir.");
  });
});

describe("validateBulkUpdateLimit", () => {
  it("count 0 ise hata döner", () => {
    const result = validateBulkUpdateLimit(0);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("En az bir görev seçilmelidir.");
  });

  it("count 1 ise geçerlidir", () => {
    expect(validateBulkUpdateLimit(1)).toEqual({ valid: true });
  });

  it("count 100 ise geçerlidir", () => {
    expect(validateBulkUpdateLimit(100)).toEqual({ valid: true });
  });

  it("count 101 ise hata döner", () => {
    const result = validateBulkUpdateLimit(101);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});
