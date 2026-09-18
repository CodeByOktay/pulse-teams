import { describe, it, expect } from "vitest";
import {
  validateStateName,
  validateLabelName,
  validateHexColor,
  canDeleteState,
  calculateStateSequences,
} from "../settings-logic";

describe("validateStateName", () => {
  it("boş string için hata döner", () => {
    const result = validateStateName("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Durum adı boş olamaz.");
  });

  it("sadece boşluk için hata döner", () => {
    const result = validateStateName("   ");
    expect(result.valid).toBe(false);
  });

  it("tek karakter için geçerlidir", () => {
    expect(validateStateName("A")).toEqual({ valid: true });
  });

  it("50 karakter için geçerlidir", () => {
    const name = "a".repeat(50);
    expect(validateStateName(name)).toEqual({ valid: true });
  });

  it("51 karakter için hata döner", () => {
    const name = "a".repeat(51);
    const result = validateStateName(name);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Durum adı en fazla 50 karakter olabilir.");
  });

  it("geçerli isim için { valid: true } döner", () => {
    expect(validateStateName("Backlog")).toEqual({ valid: true });
  });
});

describe("validateLabelName", () => {
  it("boş string için hata döner", () => {
    const result = validateLabelName("");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("sadece boşluk için hata döner", () => {
    expect(validateLabelName("   ").valid).toBe(false);
  });

  it("30 karakter için geçerlidir", () => {
    const name = "a".repeat(30);
    expect(validateLabelName(name)).toEqual({ valid: true });
  });

  it("31 karakter için hata döner", () => {
    const name = "a".repeat(31);
    const result = validateLabelName(name);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Etiket adı en fazla 30 karakter olabilir.");
  });

  it("geçerli isim için { valid: true } döner", () => {
    expect(validateLabelName("Bug")).toEqual({ valid: true });
  });
});

describe("validateHexColor", () => {
  it.each([
    ["#60646C", true],
    ["#FFFFFF", true],
    ["#abc123", true],
    ["#000000", true],
    ["#AbC123", true],
    ["#a1b2c3", true],
    ["60646C", false],
    ["#GGGGGG", false],
    ["#12345", false],
    ["", false],
    ["#1234567", false],
    ["red", false],
  ])("validateHexColor(%s) → %s", (color, expected) => {
    expect(validateHexColor(color)).toBe(expected);
  });
});

describe("canDeleteState", () => {
  it("görev varsa ve son state değilse silinemez", () => {
    const result = canDeleteState(3, 5);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Bu durumda 3 görev bulunuyor. Silmeden önce görevleri taşıyın.");
  });

  it("görev varsa ve son state ise görev mesajı önceliklidir", () => {
    const result = canDeleteState(2, 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("2 görev");
  });

  it("görev yoksa ve son state ise silinemez", () => {
    const result = canDeleteState(0, 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Projede en az bir durum bulunmalıdır.");
  });

  it("görev yoksa ve son state değilse silinebilir", () => {
    expect(canDeleteState(0, 5)).toEqual({ allowed: true });
  });
});

describe("calculateStateSequences", () => {
  it("count 0 için boş dizi döner", () => {
    expect(calculateStateSequences(0)).toEqual([]);
  });

  it("count 1 için [1000] döner", () => {
    expect(calculateStateSequences(1)).toEqual([1000]);
  });

  it("count 3 için [1000, 2000, 3000] döner", () => {
    expect(calculateStateSequences(3)).toEqual([1000, 2000, 3000]);
  });
});
