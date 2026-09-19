import { describe, it, expect } from "vitest";
import {
  parseBoardFilters,
  isBoardFiltered,
  serializeBoardFilters,
  matchesDueFilter,
  resolveDueDateRange,
  buildTaskWhereFromFilters,
  startOfDay,
  startOfWeek,
  endOfWeek,
  DUE_FILTERS,
  GROUP_FILTERS,
  type BoardFilters,
} from "../board-filters";
import {
  DEFAULT_SAVED_VIEWS,
  ME_PLACEHOLDER,
  createSavedView,
  findMatchingSavedViewId,
  parseSavedViewsFromStorage,
  resolveSavedViewQuery,
  serializeSavedViewsForStorage,
} from "../saved-views-logic";

const NOW = new Date("2026-09-19T12:00:00.000Z"); // Cumartesi (Sep 19 2026 -> Sunday actually let's rely on getDay())

function baseFilters(overrides: Partial<BoardFilters> = {}): BoardFilters {
  return {
    priorities: [],
    labelIds: [],
    assigneeIds: [],
    groups: [],
    due: null,
    query: "",
    sort: null,
    order: "desc",
    ...overrides,
  };
}

describe("gelismis filtreler - tarih araligi predicate fonksiyonlari", () => {
  it("overdue: dunku bir tarihi gecikmis sayar", () => {
    const yesterday = new Date(NOW);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(matchesDueFilter(yesterday, "overdue", NOW)).toBe(true);
  });

  it("overdue: bugunku bir tarihi gecikmis saymaz", () => {
    expect(matchesDueFilter(NOW, "overdue", NOW)).toBe(false);
  });

  it("overdue: tarihsiz gorevi gecikmis saymaz", () => {
    expect(matchesDueFilter(null, "overdue", NOW)).toBe(false);
  });

  it("today: bugunun herhangi bir saatini eslestirir", () => {
    const laterToday = new Date(NOW);
    laterToday.setHours(23, 0, 0, 0);
    expect(matchesDueFilter(laterToday, "today", NOW)).toBe(true);
  });

  it("today: yarinki bir tarihi eslestirmez", () => {
    const tomorrow = new Date(NOW);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(matchesDueFilter(tomorrow, "today", NOW)).toBe(false);
  });

  it("this_week: hafta baslangici (Pazartesi) ve sonu (Pazar) sinirlarini icerir", () => {
    const weekStart = startOfWeek(NOW);
    const weekEnd = endOfWeek(NOW);
    expect(matchesDueFilter(weekStart, "this_week", NOW)).toBe(true);
    expect(matchesDueFilter(weekEnd, "this_week", NOW)).toBe(true);
  });

  it("this_week: bir sonraki haftadaki tarihi eslestirmez", () => {
    const nextWeek = new Date(startOfWeek(NOW));
    nextWeek.setDate(nextWeek.getDate() + 8);
    expect(matchesDueFilter(nextWeek, "this_week", NOW)).toBe(false);
  });

  it("no_date: yalnizca dueDate null olan gorevleri eslestirir", () => {
    expect(matchesDueFilter(null, "no_date", NOW)).toBe(true);
    expect(matchesDueFilter(NOW, "no_date", NOW)).toBe(false);
  });

  it("resolveDueDateRange no_date icin isNull donderir", () => {
    expect(resolveDueDateRange("no_date", NOW)).toEqual({ kind: "isNull" });
  });

  it("resolveDueDateRange overdue icin gunun basina kadar (lt) sinir donderir", () => {
    const range = resolveDueDateRange("overdue", NOW);
    expect(range).toEqual({ kind: "range", lt: startOfDay(NOW) });
  });

  it("DUE_FILTERS tum gecerli degerleri icerir", () => {
    expect(DUE_FILTERS).toEqual(["overdue", "today", "this_week", "no_date"]);
  });
});

describe("gelismis filtreler - parseBoardFilters genisletilmis alanlar", () => {
  it("group CSV parametresini ayristirir ve gecersiz degerleri eler", () => {
    const result = parseBoardFilters({ group: "TODO,IN_PROGRESS,BACKLOG,INVALID" });
    expect(result.groups).toEqual(["TODO", "IN_PROGRESS"]);
    expect(isBoardFiltered(result)).toBe(true);
  });

  it("GROUP_FILTERS icinde BACKLOG bulunmaz (yalnizca 4 grup)", () => {
    expect(GROUP_FILTERS).toEqual(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]);
  });

  it("gecerli bir due degerini kabul eder", () => {
    const result = parseBoardFilters({ due: "overdue" });
    expect(result.due).toBe("overdue");
    expect(isBoardFiltered(result)).toBe(true);
  });

  it("gecersiz bir due degerini null'a dusurur", () => {
    const result = parseBoardFilters({ due: "next_month" });
    expect(result.due).toBeNull();
  });

  it("q parametresini trim ederek okur", () => {
    const result = parseBoardFilters({ q: "  giris ekrani  " });
    expect(result.query).toBe("giris ekrani");
    expect(isBoardFiltered(result)).toBe(true);
  });

  it("bos q parametresi filtrelenmemis sayilir", () => {
    const result = parseBoardFilters({ q: "   " });
    expect(result.query).toBe("");
    expect(isBoardFiltered(result)).toBe(false);
  });
});

describe("gelismis filtreler - Prisma where clause uretimi", () => {
  it("group filtresi state.group icin { in } clause uretir", () => {
    const where = buildTaskWhereFromFilters(baseFilters({ groups: ["TODO", "IN_PROGRESS"] }));
    expect(where.state).toEqual({ group: { in: ["TODO", "IN_PROGRESS"] } });
  });

  it("due=overdue filtresi dueDate icin lt clause uretir", () => {
    const where = buildTaskWhereFromFilters(baseFilters({ due: "overdue" }), NOW);
    expect(where.dueDate).toEqual({ lt: startOfDay(NOW) });
  });

  it("due=no_date filtresi dueDate: null uretir", () => {
    const where = buildTaskWhereFromFilters(baseFilters({ due: "no_date" }), NOW);
    expect(where.dueDate).toBeNull();
  });

  it("q filtresi title icin contains + insensitive clause uretir", () => {
    const where = buildTaskWhereFromFilters(baseFilters({ query: "kanban" }));
    expect(where.title).toEqual({ contains: "kanban", mode: "insensitive" });
  });

  it("filtre yoksa bos where clause uretir", () => {
    const where = buildTaskWhereFromFilters(baseFilters());
    expect(where).toEqual({});
  });
});

describe("gelismis filtreler - birden fazla filtrenin birlesimi", () => {
  it("priority + group + assignee + q birlikte tek where objesinde birlesir", () => {
    const filters = baseFilters({
      priorities: ["URGENT"],
      groups: ["TODO"],
      assigneeIds: ["user_1"],
      query: "hata",
    });
    const where = buildTaskWhereFromFilters(filters, NOW);

    expect(where).toEqual({
      priority: { in: ["URGENT"] },
      state: { group: { in: ["TODO"] } },
      assignees: { some: { userId: { in: ["user_1"] } } },
      title: { contains: "hata", mode: "insensitive" },
    });
  });

  it("due ve label filtreleri birlikte uygulandiginda ikisi de where'de yer alir", () => {
    const filters = baseFilters({ due: "today", labelIds: ["lbl_1"] });
    const where = buildTaskWhereFromFilters(filters, NOW);

    expect(where.labels).toEqual({ some: { labelId: { in: ["lbl_1"] } } });
    expect(where.dueDate).toEqual({ gte: startOfDay(NOW), lte: expect.any(Date) });
  });

  it("isBoardFiltered herhangi bir yeni alan set edildiginde true doner", () => {
    expect(isBoardFiltered(baseFilters({ groups: ["DONE"] }))).toBe(true);
    expect(isBoardFiltered(baseFilters({ due: "today" }))).toBe(true);
    expect(isBoardFiltered(baseFilters({ query: "x" }))).toBe(true);
    expect(isBoardFiltered(baseFilters())).toBe(false);
  });
});

describe("kayitli gorunumler - URL query string serialization ve parsing", () => {
  it("serializeBoardFilters bos filtre icin bos string uretir", () => {
    expect(serializeBoardFilters(baseFilters())).toBe("");
  });

  it("serializeBoardFilters + parseBoardFilters roundtrip calisir", () => {
    const filters = baseFilters({
      priorities: ["HIGH", "URGENT"],
      groups: ["TODO"],
      due: "this_week",
      query: "api",
      sort: "dueDate",
      order: "asc",
    });

    const qs = serializeBoardFilters(filters);
    const roundTripped = parseBoardFilters(Object.fromEntries(new URLSearchParams(qs)));

    expect(roundTripped).toEqual(filters);
  });

  it("serializeBoardFilters sort yoksa order'i URL'ye eklemez", () => {
    const qs = serializeBoardFilters(baseFilters({ priorities: ["LOW"] }));
    expect(qs).toContain("priority=LOW");
    expect(qs).not.toContain("order=");
  });

  it("resolveSavedViewQuery __me__ yer tutucusunu gercek kullanici ID'siyle degistirir", () => {
    const resolved = resolveSavedViewQuery(`assignee=${ME_PLACEHOLDER}`, "user_42");
    expect(resolved).toBe("assignee=user_42");
  });

  it("resolveSavedViewQuery kullanici bilinmiyorsa query'yi degistirmeden doner", () => {
    const query = `assignee=${ME_PLACEHOLDER}`;
    expect(resolveSavedViewQuery(query, undefined)).toBe(query);
  });

  it("DEFAULT_SAVED_VIEWS beklenen 3 varsayilan gorunumu icerir", () => {
    expect(DEFAULT_SAVED_VIEWS.map((v) => v.name)).toEqual([
      "Varsayılan",
      "Benim Görevlerim",
      "Acil Durumlar",
    ]);
    expect(DEFAULT_SAVED_VIEWS.every((v) => v.isDefault)).toBe(true);
  });

  it("createSavedView benzersiz id ile bir SavedView olusturur", () => {
    const view = createSavedView("Sprint Hazirlik", "priority=HIGH");
    expect(view.name).toBe("Sprint Hazirlik");
    expect(view.query).toBe("priority=HIGH");
    expect(typeof view.id).toBe("string");
    expect(view.id.length).toBeGreaterThan(0);
  });

  it("parseSavedViewsFromStorage gecersiz JSON icin bos dizi doner", () => {
    expect(parseSavedViewsFromStorage("{ bozuk json")).toEqual([]);
    expect(parseSavedViewsFromStorage(null)).toEqual([]);
  });

  it("parseSavedViewsFromStorage gecerli olmayan ogeleri filtreler", () => {
    const raw = JSON.stringify([
      { id: "v1", name: "Gecerli", query: "priority=HIGH" },
      { id: "v2", name: "Eksik" },
      "string-degeri",
    ]);
    expect(parseSavedViewsFromStorage(raw)).toEqual([
      { id: "v1", name: "Gecerli", query: "priority=HIGH" },
    ]);
  });

  it("serializeSavedViewsForStorage + parseSavedViewsFromStorage roundtrip calisir", () => {
    const views = [createSavedView("A", "priority=LOW"), createSavedView("B", "due=today")];
    const roundTripped = parseSavedViewsFromStorage(serializeSavedViewsForStorage(views));
    expect(roundTripped).toEqual(views);
  });

  it("findMatchingSavedViewId aktif filtreye esdeger olan gorunumu bulur", () => {
    const views = [
      { id: "a", name: "A", query: "priority=URGENT" },
      { id: "b", name: "B", query: `assignee=${ME_PLACEHOLDER}` },
    ];
    expect(findMatchingSavedViewId(views, "priority=URGENT")).toBe("a");
    expect(findMatchingSavedViewId(views, "assignee=user_9", "user_9")).toBe("b");
    expect(findMatchingSavedViewId(views, "priority=LOW")).toBeNull();
  });
});
