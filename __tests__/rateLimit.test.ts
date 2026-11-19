import { describe, expect, it } from "vitest";
import { rateLimitOk } from "../lib/rateLimit";

describe("rateLimitOk", () => {
  it("allows up to the limit within a window, then blocks", () => {
    const key = "test-ip-" + Math.random();
    for (let i = 0; i < 10; i++) {
      expect(rateLimitOk(key, 10, 60_000)).toBe(true);
    }
    expect(rateLimitOk(key, 10, 60_000)).toBe(false);
  });

  it("resets after the window", () => {
    const key = "test-ip-" + Math.random();
    expect(rateLimitOk(key, 1, -1)).toBe(true);
    expect(rateLimitOk(key, 1, 60_000)).toBe(true);
    expect(rateLimitOk(key, 1, 60_000)).toBe(false);
  });
});
