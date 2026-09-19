import { describe, it, expect } from "vitest";

// ──────────────────────────────────────────────────────────────────────
// Pure business logic extracted from member management actions
// ──────────────────────────────────────────────────────────────────────

type InviteStatus = "PENDING" | "ACCEPTED" | "EXPIRED";

interface Invite {
  status: InviteStatus;
  expiresAt: Date;
  email: string;
  role: string;
}

interface ProjectMember {
  userId: string;
  role: string;
}

// ─── Validation helpers (pure, testable) ─────────────────────────────

function isInviteExpired(invite: Invite): boolean {
  return invite.status === "EXPIRED" || invite.expiresAt < new Date();
}

function canRemoveMember(ownerId: string, targetUserId: string): { ok: boolean; reason?: string } {
  if (targetUserId === ownerId) {
    return { ok: false, reason: "Proje sahibi projeden çıkartılamaz." };
  }
  return { ok: true };
}

function canChangeRole(ownerId: string, targetUserId: string): { ok: boolean; reason?: string } {
  if (targetUserId === ownerId) {
    return { ok: false, reason: "Proje sahibinin rolü değiştirilemez." };
  }
  return { ok: true };
}

function validateInviteEmail(
  email: string,
  existingMembers: Array<{ email: string }>,
  pendingInviteEmails: string[]
): { ok: boolean; reason?: string } {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { ok: false, reason: "Geçerli bir e-posta adresi girin." };
  }
  if (existingMembers.some((m) => m.email.toLowerCase() === normalized)) {
    return { ok: false, reason: "Bu kullanıcı zaten projenin üyesi." };
  }
  if (pendingInviteEmails.some((e) => e.toLowerCase() === normalized)) {
    return { ok: false, reason: "Bu e-posta adresine zaten bekleyen bir davet gönderilmiş." };
  }
  return { ok: true };
}

function emailMatchesInvite(sessionEmail: string, inviteEmail: string): boolean {
  return sessionEmail.toLowerCase() === inviteEmail.toLowerCase();
}

function generateInviteExpiry(daysValid = 7): Date {
  return new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
}

function isAdminRole(role: string): boolean {
  return role === "ADMIN";
}

function toggleRole(currentRole: string): "MEMBER" | "ADMIN" {
  return currentRole === "ADMIN" ? "MEMBER" : "ADMIN";
}

function getPendingInvites(invites: Invite[]): Invite[] {
  return invites.filter((inv) => inv.status === "PENDING" && !isInviteExpired(inv));
}

function canUserAcceptInvite(
  invite: Invite,
  sessionEmail: string
): { ok: boolean; reason?: string } {
  if (isInviteExpired(invite)) {
    return { ok: false, reason: "Bu davet süresi dolmuş." };
  }
  if (invite.status === "ACCEPTED") {
    return { ok: false, reason: "Bu davet daha önce kabul edilmiş." };
  }
  if (!emailMatchesInvite(sessionEmail, invite.email)) {
    return { ok: false, reason: "E-posta adresi uyuşmuyor." };
  }
  return { ok: true };
}

function countMembersByRole(members: ProjectMember[]): Record<string, number> {
  return members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});
}

// ──────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────

describe("isInviteExpired", () => {
  it("geçmiş tarihteki davet süresi dolmuş sayılır", () => {
    const past = new Date(Date.now() - 1000);
    expect(isInviteExpired({ status: "PENDING", expiresAt: past, email: "", role: "" })).toBe(true);
  });

  it("gelecek tarihteki PENDING davet geçerlidir", () => {
    const future = new Date(Date.now() + 86400000);
    expect(isInviteExpired({ status: "PENDING", expiresAt: future, email: "", role: "" })).toBe(false);
  });

  it("status EXPIRED ise tarihten bağımsız süresi dolmuş sayılır", () => {
    const future = new Date(Date.now() + 86400000);
    expect(isInviteExpired({ status: "EXPIRED", expiresAt: future, email: "", role: "" })).toBe(true);
  });
});

describe("canRemoveMember", () => {
  it("proje sahibini çıkartmaya izin vermez", () => {
    const result = canRemoveMember("owner-1", "owner-1");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("çıkartılamaz");
  });

  it("diğer üyelerin çıkartılmasına izin verir", () => {
    expect(canRemoveMember("owner-1", "member-2").ok).toBe(true);
  });
});

describe("canChangeRole", () => {
  it("proje sahibinin rolü değiştirilemez", () => {
    const result = canChangeRole("owner-1", "owner-1");
    expect(result.ok).toBe(false);
  });

  it("diğer üyelerin rolü değiştirilebilir", () => {
    expect(canChangeRole("owner-1", "member-2").ok).toBe(true);
  });
});

describe("validateInviteEmail", () => {
  const members = [{ email: "alice@test.com" }];
  const pending = ["bob@test.com"];

  it("geçersiz e-posta formatını reddeder", () => {
    expect(validateInviteEmail("notanemail", members, pending).ok).toBe(false);
  });

  it("boş e-postayı reddeder", () => {
    expect(validateInviteEmail("", members, pending).ok).toBe(false);
  });

  it("zaten üye olan e-postayı reddeder", () => {
    const result = validateInviteEmail("alice@test.com", members, pending);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("zaten projenin üyesi");
  });

  it("bekleyen daveti olan e-postayı reddeder", () => {
    const result = validateInviteEmail("bob@test.com", members, pending);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("bekleyen bir davet");
  });

  it("büyük/küçük harf farkını gözetmeksizin kontrol eder", () => {
    expect(validateInviteEmail("ALICE@TEST.COM", members, pending).ok).toBe(false);
  });

  it("yeni geçerli e-postayı kabul eder", () => {
    expect(validateInviteEmail("charlie@test.com", members, pending).ok).toBe(true);
  });
});

describe("emailMatchesInvite", () => {
  it("aynı e-posta eşleşir", () => {
    expect(emailMatchesInvite("user@test.com", "user@test.com")).toBe(true);
  });

  it("büyük/küçük harf farkını gözetmez", () => {
    expect(emailMatchesInvite("USER@TEST.COM", "user@test.com")).toBe(true);
  });

  it("farklı e-posta eşleşmez", () => {
    expect(emailMatchesInvite("other@test.com", "user@test.com")).toBe(false);
  });
});

describe("generateInviteExpiry", () => {
  it("varsayılan 7 gün geçerlilik üretir", () => {
    const expiry = generateInviteExpiry();
    const diff = expiry.getTime() - Date.now();
    expect(diff).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000);
  });

  it("özel gün sayısıyla çalışır", () => {
    const expiry = generateInviteExpiry(14);
    const diff = expiry.getTime() - Date.now();
    expect(diff).toBeGreaterThan(13 * 24 * 60 * 60 * 1000);
  });
});

describe("toggleRole", () => {
  it("ADMIN → MEMBER döndürür", () => {
    expect(toggleRole("ADMIN")).toBe("MEMBER");
  });

  it("MEMBER → ADMIN döndürür", () => {
    expect(toggleRole("MEMBER")).toBe("ADMIN");
  });
});

describe("canUserAcceptInvite", () => {
  const validInvite: Invite = {
    status: "PENDING",
    expiresAt: new Date(Date.now() + 86400000),
    email: "user@test.com",
    role: "MEMBER",
  };

  it("geçerli davet ve eşleşen e-posta → kabul edilebilir", () => {
    expect(canUserAcceptInvite(validInvite, "user@test.com").ok).toBe(true);
  });

  it("süresi dolmuş davet reddedilir", () => {
    const expired = { ...validInvite, expiresAt: new Date(Date.now() - 1000) };
    expect(canUserAcceptInvite(expired, "user@test.com").ok).toBe(false);
  });

  it("zaten kabul edilmiş davet reddedilir", () => {
    const accepted = { ...validInvite, status: "ACCEPTED" as InviteStatus };
    expect(canUserAcceptInvite(accepted, "user@test.com").ok).toBe(false);
  });

  it("e-posta uyuşmazlığı reddedilir", () => {
    const result = canUserAcceptInvite(validInvite, "other@test.com");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("uyuşmuyor");
  });
});

describe("countMembersByRole", () => {
  it("rollere göre üye sayısını doğru hesaplar", () => {
    const members: ProjectMember[] = [
      { userId: "1", role: "ADMIN" },
      { userId: "2", role: "MEMBER" },
      { userId: "3", role: "MEMBER" },
    ];
    const counts = countMembersByRole(members);
    expect(counts["ADMIN"]).toBe(1);
    expect(counts["MEMBER"]).toBe(2);
  });

  it("boş liste için boş obje döndürür", () => {
    expect(countMembersByRole([])).toEqual({});
  });
});

describe("getPendingInvites", () => {
  it("sadece geçerli bekleyen davetleri döndürür", () => {
    const invites: Invite[] = [
      { status: "PENDING", expiresAt: new Date(Date.now() + 86400000), email: "a@t.com", role: "MEMBER" },
      { status: "ACCEPTED", expiresAt: new Date(Date.now() + 86400000), email: "b@t.com", role: "MEMBER" },
      { status: "PENDING", expiresAt: new Date(Date.now() - 1000), email: "c@t.com", role: "MEMBER" },
      { status: "EXPIRED", expiresAt: new Date(Date.now() + 86400000), email: "d@t.com", role: "MEMBER" },
    ];
    const pending = getPendingInvites(invites);
    expect(pending).toHaveLength(1);
    expect(pending[0].email).toBe("a@t.com");
  });
});

describe("isAdminRole", () => {
  it("ADMIN rolünü doğru tanır", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("MEMBER")).toBe(false);
    expect(isAdminRole("")).toBe(false);
  });
});
