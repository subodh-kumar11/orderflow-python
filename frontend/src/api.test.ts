import { describe, expect, it, vi } from "vitest";
import { dateTime, labels, money, nextStatus, request, statuses } from "./api";

describe("display and lifecycle helpers", () => {
  it("formats exact display money", () =>
    expect(money("25.30")).toBe("$25.30"));
  it("formats zero", () => expect(money("0.00")).toBe("$0.00"));
  it("formats order dates", () =>
    expect(dateTime("2026-01-02T12:00:00Z")).toContain("2026"));
  it("labels every status", () =>
    expect(statuses.map((s) => labels[s])).toEqual([
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ]));
  it("has no actions for terminal statuses", () => {
    expect(nextStatus.DELIVERED).toBeUndefined();
    expect(nextStatus.CANCELLED).toBeUndefined();
  });
  it("advances only one state at a time", () =>
    expect(nextStatus).toEqual({
      PENDING: "PROCESSING",
      PROCESSING: "SHIPPED",
      SHIPPED: "DELIVERED",
    }));
});
describe("HTTP client", () => {
  it("returns successful JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "1" }) }),
    );
    expect(await request("/api/orders/1")).toEqual({ id: "1" });
  });
  it("displays problem details", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({ detail: "Order changed" }),
        }),
    );
    await expect(request("/api/orders/1")).rejects.toThrow("Order changed");
  });
  it("handles a non-JSON error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => {
          throw new Error("html");
        },
      }),
    );
    await expect(request("/api/orders")).rejects.toThrow(
      "Request failed (503)",
    );
  });
});
