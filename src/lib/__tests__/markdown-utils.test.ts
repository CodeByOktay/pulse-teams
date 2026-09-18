import { describe, it, expect } from "vitest";
import { stripMarkdown, truncateMarkdown, countWords } from "../markdown-utils";

describe("stripMarkdown", () => {
  it("kalın metni temizler", () => {
    expect(stripMarkdown("**Hello** world")).toBe("Hello world");
  });

  it("başlığı temizler", () => {
    expect(stripMarkdown("# Başlık\n\nParagraf")).toBe("Başlık\n\nParagraf");
  });

  it("liste madde işaretlerini temizler", () => {
    expect(stripMarkdown("- Madde 1\n- Madde 2")).toBe("Madde 1\nMadde 2");
  });

  it("inline kodu temizler", () => {
    expect(stripMarkdown("`kod`")).toBe("kod");
  });

  it("linki metne indirger", () => {
    expect(stripMarkdown("[link](https://example.com)")).toBe("link");
  });

  it("boş string için boş string döner", () => {
    expect(stripMarkdown("")).toBe("");
  });

  it("italik metni temizler", () => {
    expect(stripMarkdown("*italik* metin")).toBe("italik metin");
  });

  it("blockquote işaretini temizler", () => {
    expect(stripMarkdown("> alıntı metni")).toBe("alıntı metni");
  });

  it("numaralı liste işaretlerini temizler", () => {
    expect(stripMarkdown("1. Birinci\n2. İkinci")).toBe("Birinci\nİkinci");
  });
});

describe("truncateMarkdown", () => {
  it("maxLength'ten kısa metin aynen döner", () => {
    expect(truncateMarkdown("Kısa metin", 100)).toBe("Kısa metin");
  });

  it("maxLength'e eşit metin aynen döner", () => {
    const text = "12345";
    expect(truncateMarkdown(text, 5)).toBe(text);
  });

  it("maxLength'ten uzun metin kısaltılır ve ... eklenir", () => {
    const text = "Bu oldukça uzun bir metin örneğidir ve kesinlikle kısaltılmalıdır";
    const result = truncateMarkdown(text, 20);
    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(23);
  });

  it("tam sözcük sınırında keser, kelimeyi bölmez", () => {
    const text = "kelime birkelime uzunkelime cokuzunbirkelime";
    const result = truncateMarkdown(text, 15);
    const withoutEllipsis = result.slice(0, -3);
    expect(text.startsWith(withoutEllipsis)).toBe(true);
    expect(text[withoutEllipsis.length]).toBe(" ");
  });

  it("bold sözdizimi ortasında kesmez — dengesiz ** bırakmaz", () => {
    const text = "Bu **önemli kelime** burada devam eden uzun bir cümledir ve kesilecektir";
    const result = truncateMarkdown(text, 12);
    const boldMarkerCount = (result.match(/\*\*/g) ?? []).length;
    expect(boldMarkerCount % 2).toBe(0);
  });

  it("inline kod ortasında kesmez — dengesiz ` bırakmaz", () => {
    const text = "Kod örneği `const x = uzunDegiskenAdi` burada devam eder ve kesilecektir";
    const result = truncateMarkdown(text, 15);
    const codeMarkerCount = (result.match(/`/g) ?? []).length;
    expect(codeMarkerCount % 2).toBe(0);
  });
});

describe("countWords", () => {
  it("boş string için 0 döner", () => {
    expect(countWords("")).toBe(0);
  });

  it("sadece boşluk için 0 döner", () => {
    expect(countWords("   ")).toBe(0);
  });

  it("tek kelime için 1 döner", () => {
    expect(countWords("Merhaba")).toBe(1);
  });

  it("'Hello World' için 2 döner", () => {
    expect(countWords("Hello World")).toBe(2);
  });

  it("ardışık boşluklar tek boşluk gibi sayılır", () => {
    expect(countWords("  multiple   spaces  ")).toBe(2);
  });

  it("newline ile ayrılmış kelimeler doğru sayılır", () => {
    expect(countWords("Satır bir\nSatır iki\nSatır üç")).toBe(6);
  });
});
