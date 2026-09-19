import { describe, it, expect } from "vitest";
import {
  isTaskOverdue,
  countOverdueTasks,
  calculateCompletionRate,
  calculateSprintBurndown,
  calculateProjectVelocity,
  formatRelativeTime,
} from "../analytics-logic";

const NOW = new Date(2026, 5, 15, 12, 0, 0);

describe("isTaskOverdue", () => {
  it("dueDate yoksa gecikmiş sayılmaz", () => {
    expect(isTaskOverdue(null, "TODO", NOW)).toBe(false);
  });

  it("DONE durumundaki görev geçmiş tarihli olsa da gecikmiş sayılmaz", () => {
    const pastDate = new Date(2026, 5, 1);
    expect(isTaskOverdue(pastDate, "DONE", NOW)).toBe(false);
  });

  it("CANCELLED durumundaki görev geçmiş tarihliyse yine de gecikmiş sayılır (yalnızca DONE hariç tutulur)", () => {
    const pastDate = new Date(2026, 5, 1);
    expect(isTaskOverdue(pastDate, "CANCELLED", NOW)).toBe(true);
  });

  it("gelecek tarihli görev gecikmiş sayılmaz", () => {
    const futureDate = new Date(2026, 5, 20);
    expect(isTaskOverdue(futureDate, "TODO", NOW)).toBe(false);
  });

  it("geçmiş tarihli ve DONE olmayan görev gecikmiş sayılır", () => {
    const pastDate = new Date(2026, 5, 10);
    expect(isTaskOverdue(pastDate, "IN_PROGRESS", NOW)).toBe(true);
  });
});

describe("countOverdueTasks", () => {
  it("boş listede 0 döner", () => {
    expect(countOverdueTasks([], NOW)).toBe(0);
  });

  it("yalnızca gecikmiş ve DONE olmayan görevleri sayar", () => {
    const tasks = [
      { dueDate: new Date(2026, 5, 1), state: { group: "TODO" as const } },
      { dueDate: new Date(2026, 5, 1), state: { group: "DONE" as const } },
      { dueDate: new Date(2026, 5, 20), state: { group: "TODO" as const } },
      { dueDate: null, state: { group: "IN_PROGRESS" as const } },
    ];
    expect(countOverdueTasks(tasks, NOW)).toBe(1);
  });
});

describe("calculateCompletionRate", () => {
  it("0 görevde 0 döner (division by zero engellenir)", () => {
    expect(calculateCompletionRate([])).toBe(0);
  });

  it("tüm görevler DONE ise 100 döner", () => {
    const tasks = [
      { state: { group: "DONE" as const } },
      { state: { group: "DONE" as const } },
    ];
    expect(calculateCompletionRate(tasks)).toBe(100);
  });

  it("hiçbir görev DONE değilse 0 döner", () => {
    const tasks = [{ state: { group: "TODO" as const } }, { state: { group: "IN_PROGRESS" as const } }];
    expect(calculateCompletionRate(tasks)).toBe(0);
  });

  it("kesirli sonuçları en yakın tam sayıya yuvarlar (1/3 → 33)", () => {
    const tasks = [
      { state: { group: "DONE" as const } },
      { state: { group: "TODO" as const } },
      { state: { group: "TODO" as const } },
    ];
    expect(calculateCompletionRate(tasks)).toBe(33);
  });

  it("kesirli sonuçları en yakın tam sayıya yuvarlar (2/3 → 67)", () => {
    const tasks = [
      { state: { group: "DONE" as const } },
      { state: { group: "DONE" as const } },
      { state: { group: "TODO" as const } },
    ];
    expect(calculateCompletionRate(tasks)).toBe(67);
  });
});

describe("calculateSprintBurndown", () => {
  it("tamamlanan görev arttıkça kalan görev azalır", () => {
    expect(calculateSprintBurndown(10, [0, 2, 5, 10])).toEqual([10, 8, 5, 0]);
  });

  it("tamamlanan görev sayısı toplamı aşsa da negatife düşmez", () => {
    expect(calculateSprintBurndown(5, [0, 3, 8])).toEqual([5, 2, 0]);
  });

  it("boş tarih listesinde boş dizi döner", () => {
    expect(calculateSprintBurndown(10, [])).toEqual([]);
  });
});

describe("calculateProjectVelocity", () => {
  it("tamamlanmış sprint yoksa 0 döner", () => {
    expect(calculateProjectVelocity([])).toBe(0);
  });

  it("tek sprintte ortalama o sprintin değeridir", () => {
    expect(calculateProjectVelocity([8])).toBe(8);
  });

  it("birden fazla sprintte ortalamayı bir ondalık basamağa yuvarlar", () => {
    expect(calculateProjectVelocity([10, 5, 6])).toBe(7);
  });

  it("tam bölünmeyen ortalamalarda ondalık kısmı korur", () => {
    expect(calculateProjectVelocity([10, 5])).toBe(7.5);
  });
});

describe("formatRelativeTime", () => {
  it("1 dakikadan az önce ise 'az önce' döner", () => {
    const date = new Date(NOW.getTime() - 30 * 1000);
    expect(formatRelativeTime(date, NOW)).toBe("az önce");
  });

  it("dakika cinsinden fark gösterir", () => {
    const date = new Date(NOW.getTime() - 5 * 60 * 1000);
    expect(formatRelativeTime(date, NOW)).toBe("5 dakika önce");
  });

  it("saat cinsinden fark gösterir", () => {
    const date = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(date, NOW)).toBe("3 saat önce");
  });

  it("tam 1 gün önce ise 'dün' döner", () => {
    const date = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date, NOW)).toBe("dün");
  });

  it("gün cinsinden fark gösterir", () => {
    const date = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(date, NOW)).toBe("5 gün önce");
  });

  it("30 günden eski tarihlerde yerel tarih biçimine döner", () => {
    const date = new Date(2026, 0, 1);
    expect(formatRelativeTime(date, NOW)).toBe(date.toLocaleDateString("tr-TR"));
  });
});
