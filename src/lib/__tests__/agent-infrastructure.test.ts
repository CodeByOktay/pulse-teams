import { describe, it, expect, vi, afterEach } from "vitest";
import { getNow, setMockClock, resetMockClock } from "@/lib/clock";
import { verifyInternalSignature } from "@/lib/internal-auth";
import { emitDomainEvent } from "@/lib/domain-events";
import crypto from "crypto";

describe("Agent Infrastructure — Clock Abstraction", () => {
  afterEach(() => {
    resetMockClock();
  });

  it("returns current system time when no mock is set", () => {
    const before = Date.now();
    const now = getNow();
    const after = Date.now();

    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });

  it("pins clock when setMockClock is called with a Date", () => {
    const target = new Date("2026-10-15T09:00:00.000Z");
    setMockClock(target);

    expect(getNow().toISOString()).toBe("2026-10-15T09:00:00.000Z");
    expect(getNow().getTime()).toBe(target.getTime());
  });

  it("pins clock when setMockClock is called with an ISO string", () => {
    setMockClock("2026-12-31T23:59:59.000Z");

    expect(getNow().toISOString()).toBe("2026-12-31T23:59:59.000Z");
  });

  it("returns an immutable/fresh copy each time to prevent mutation corruption", () => {
    const target = new Date("2026-06-01T12:00:00.000Z");
    setMockClock(target);

    const first = getNow();
    first.setFullYear(2030); // Mutate the returned date

    const second = getNow();
    expect(second.toISOString()).toBe("2026-06-01T12:00:00.000Z");
  });

  it("restores system clock when resetMockClock is called", () => {
    setMockClock("1999-01-01T00:00:00.000Z");
    expect(getNow().getFullYear()).toBe(1999);

    resetMockClock();
    expect(getNow().getFullYear()).toBeGreaterThan(2020);
  });
});

describe("Agent Infrastructure — HMAC Internal Auth", () => {
  const SECRET = process.env.INTERNAL_API_SECRET || "pulse-internal-secret-key-change-in-prod";

  function createSignedHeaders(body: string, timestamp: number, secret = SECRET): Headers {
    const message = `${timestamp}.${body}`;
    const signature = crypto.createHmac("sha256", secret).update(message).digest("hex");

    const headers = new Headers();
    headers.set("x-agent-signature", signature);
    headers.set("x-agent-timestamp", String(timestamp));
    headers.set("content-type", "application/json");
    return headers;
  }

  it("accepts valid signature within time drift window", () => {
    const body = JSON.stringify({ projectId: "prj-123", test: true });
    const headers = createSignedHeaders(body, Date.now());

    expect(verifyInternalSignature(headers, body)).toBe(true);
  });

  it("rejects request if x-agent-signature header is missing", () => {
    const headers = new Headers();
    headers.set("x-agent-timestamp", String(Date.now()));

    expect(verifyInternalSignature(headers, "{}")).toBe(false);
  });

  it("rejects request if x-agent-timestamp header is missing", () => {
    const headers = new Headers();
    headers.set("x-agent-signature", "some-signature");

    expect(verifyInternalSignature(headers, "{}")).toBe(false);
  });

  it("rejects request if timestamp is invalid / non-numeric", () => {
    const headers = new Headers();
    headers.set("x-agent-signature", "some-signature");
    headers.set("x-agent-timestamp", "not-a-number");

    expect(verifyInternalSignature(headers, "{}")).toBe(false);
  });

  it("rejects request if timestamp is expired (drift > 5 minutes in past)", () => {
    const body = "{}";
    const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
    const headers = createSignedHeaders(body, sixMinutesAgo);

    expect(verifyInternalSignature(headers, body)).toBe(false);
  });

  it("rejects request if timestamp is too far in future (drift > 5 minutes in future)", () => {
    const body = "{}";
    const sixMinutesFuture = Date.now() + 6 * 60 * 1000;
    const headers = createSignedHeaders(body, sixMinutesFuture);

    expect(verifyInternalSignature(headers, body)).toBe(false);
  });

  it("rejects request if body was altered after signature generation", () => {
    const originalBody = JSON.stringify({ amount: 100 });
    const headers = createSignedHeaders(originalBody, Date.now());

    const tamperedBody = JSON.stringify({ amount: 999 });
    expect(verifyInternalSignature(headers, tamperedBody)).toBe(false);
  });

  it("rejects request signed with an incorrect secret", () => {
    const body = "{}";
    const headers = createSignedHeaders(body, Date.now(), "wrong-secret-key");

    expect(verifyInternalSignature(headers, body)).toBe(false);
  });
});

describe("Agent Infrastructure — Domain Events", () => {
  it("creates a domain event in PENDING status", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      id: "evt-1",
      type: "TASK_STATE_CHANGED",
      status: "PENDING",
      payload: { projectId: "prj-1", taskId: "tsk-1" },
    });

    const mockTx = {
      domainEvent: {
        create: mockCreate,
      },
    } as any;

    const result = await emitDomainEvent(mockTx, "TASK_STATE_CHANGED", {
      projectId: "prj-1",
      taskId: "tsk-1",
    });

    expect(result).not.toBeNull();
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        type: "TASK_STATE_CHANGED",
        payload: { projectId: "prj-1", taskId: "tsk-1" },
        status: "PENDING",
      },
    });
  });

  it("catches error and returns null without throwing when DB insert fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockTx = {
      domainEvent: {
        create: vi.fn().mockRejectedValue(new Error("Database connection lost")),
      },
    } as any;

    const result = await emitDomainEvent(mockTx, "TASK_CREATED", {
      projectId: "prj-1",
      taskId: "tsk-1",
    });

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
