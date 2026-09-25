import { describe, it, expect } from "vitest";
import {
  canRequestProgress,
  validateProgressResponseContent,
  formatProgressRequestNotification,
  PROGRESS_RESPONSE_MIN_LENGTH,
  PROGRESS_RESPONSE_MAX_LENGTH,
} from "../progress-logic";

describe("progress-logic — Constants", () => {
  it("minimum ve maksimum yanıt uzunluk sabitleri doğru tanımlanmıştır", () => {
    expect(PROGRESS_RESPONSE_MIN_LENGTH).toBe(3);
    expect(PROGRESS_RESPONSE_MAX_LENGTH).toBe(2000);
  });
});

describe("progress-logic — canRequestProgress", () => {
  it("TODO durumundaki atanmış ve bekleyen talebi olmayan görev için izin verir", () => {
    const result = canRequestProgress("TODO", 1, false);
    expect(result).toEqual({ allowed: true });
  });

  it("IN_PROGRESS durumundaki atanmış ve bekleyen talebi olmayan görev için izin verir", () => {
    const result = canRequestProgress("IN_PROGRESS", 2, false);
    expect(result).toEqual({ allowed: true });
  });

  it("BACKLOG durumundaki atanmış ve bekleyen talebi olmayan görev için izin verir", () => {
    const result = canRequestProgress("BACKLOG", 1, false);
    expect(result).toEqual({ allowed: true });
  });

  it("görev DONE grubunda ise ilerleme istenemez", () => {
    const result = canRequestProgress("DONE", 1, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Tamamlanan veya iptal edilen görevler için ilerleme istenemez.");
  });

  it("görev CANCELLED grubunda ise ilerleme istenemez", () => {
    const result = canRequestProgress("CANCELLED", 1, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Tamamlanan veya iptal edilen görevler için ilerleme istenemez.");
  });

  it("görevin hiç atananı yoksa ilerleme istenemez", () => {
    const result = canRequestProgress("IN_PROGRESS", 0, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Görevin atanmış bir üyesi bulunmuyor.");
  });

  it("görev için zaten bekleyen bir talep varsa mükerrer talep açılamaz", () => {
    const result = canRequestProgress("IN_PROGRESS", 1, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Bu görev için zaten bekleyen bir ilerleme talebi var.");
  });

  it("tamamlanmış görevde atanan olmasa bile ilk olarak tamamlanma hatası döner", () => {
    const result = canRequestProgress("DONE", 0, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Tamamlanan veya iptal edilen");
  });

  it("atananı olmayan görevde bekleyen talep olsa bile ilk olarak atanan hatası döner", () => {
    const result = canRequestProgress("IN_PROGRESS", 0, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Görevin atanmış bir üyesi bulunmuyor.");
  });
});

describe("progress-logic — validateProgressResponseContent", () => {
  it("geçerli uzunluktaki yanıta onay verir", () => {
    const result = validateProgressResponseContent("Tasarım bitti, API entegrasyonu sürüyor.");
    expect(result).toEqual({ valid: true });
  });

  it("tam alt sınırda (3 karakter) yanıta onay verir", () => {
    const result = validateProgressResponseContent("Ok!");
    expect(result).toEqual({ valid: true });
  });

  it("tam üst sınırda (2000 karakter) yanıta onay verir", () => {
    const exact2000 = "a".repeat(2000);
    const result = validateProgressResponseContent(exact2000);
    expect(result).toEqual({ valid: true });
  });

  it("boş metin verildiğinde hata döner", () => {
    const result = validateProgressResponseContent("");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("en az 3 karakter");
  });

  it("sadece boşluk karakterleri verildiğinde kırpılır ve hata döner", () => {
    const result = validateProgressResponseContent("     ");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("en az 3 karakter");
  });

  it("kırpıldığında 2 karakter kalan metne hata döner", () => {
    const result = validateProgressResponseContent("  ab  ");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("en az 3 karakter");
  });

  it("2001 karakterlik metne üst sınır hatası döner", () => {
    const overLimit = "b".repeat(2001);
    const result = validateProgressResponseContent(overLimit);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("en fazla 2000 karakter");
  });

  it("başında ve sonunda boşluk olan 2000 karakterlik metin trim edildikten sonra geçerlidir", () => {
    const padded = "   " + "c".repeat(2000) + "   ";
    const result = validateProgressResponseContent(padded);
    expect(result.valid).toBe(true);
  });
});

describe("progress-logic — formatProgressRequestNotification", () => {
  it("talep eden kişi adı belirtildiğinde Türkçe başlık ve kişiselleştirilmiş mesaj üretir", () => {
    const { title, message } = formatProgressRequestNotification(
      "Dashboard Geliştir",
      "Ahmet Yılmaz",
    );
    expect(title).toBe("İlerleme durumu talep edildi");
    expect(message).toBe("'Ahmet Yılmaz' 'Dashboard Geliştir' görevi için durum güncellemesi istedi.");
  });

  it("talep eden adı tanımsız ise 'Bir kullanıcı' yedeğini kullanır", () => {
    const { title, message } = formatProgressRequestNotification(
      "Backend Auth API",
      undefined,
    );
    expect(title).toBe("İlerleme durumu talep edildi");
    expect(message).toBe("'Bir kullanıcı' 'Backend Auth API' görevi için durum güncellemesi istedi.");
  });
});
