import { describe, it, expect } from "vitest";
import { validateSprintDates, canDeleteSprint, canStartSprint } from "../sprint-logic";

describe("validateSprintDates", () => {
  it("startDate ve endDate belirtilmemişse geçerlidir", () => {
    expect(validateSprintDates()).toEqual({ valid: true });
  });

  it("sadece startDate varsa geçerlidir", () => {
    expect(validateSprintDates(new Date(2026, 2, 5))).toEqual({ valid: true });
  });

  it("sadece endDate varsa geçerlidir", () => {
    expect(validateSprintDates(undefined, new Date(2026, 2, 5))).toEqual({ valid: true });
  });

  it("endDate startDate'den sonra ise geçerlidir", () => {
    const result = validateSprintDates(new Date(2026, 2, 5), new Date(2026, 2, 19));
    expect(result.valid).toBe(true);
  });

  it("endDate startDate'den önce ise geçersizdir", () => {
    const result = validateSprintDates(new Date(2026, 2, 19), new Date(2026, 2, 5));
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("endDate startDate'e eşitse geçersizdir", () => {
    const sameDate = new Date(2026, 2, 5);
    const result = validateSprintDates(sameDate, new Date(sameDate));
    expect(result.valid).toBe(false);
  });
});

describe("canDeleteSprint", () => {
  it("DRAFT sprint silinebilir", () => {
    expect(canDeleteSprint("DRAFT")).toEqual({ allowed: true });
  });

  it("ACTIVE sprint silinemez", () => {
    const result = canDeleteSprint("ACTIVE");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("COMPLETED sprint silinemez", () => {
    const result = canDeleteSprint("COMPLETED");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

describe("canStartSprint", () => {
  it("aktif sprint yoksa başlatılabilir", () => {
    expect(canStartSprint(false)).toEqual({ allowed: true });
  });

  it("aktif sprint varsa başlatılamaz", () => {
    const result = canStartSprint(true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });
});
