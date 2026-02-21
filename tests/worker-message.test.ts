import { describe, expect, it } from "vitest";

import { isWorkerMessage } from "../src/entities/worker";

describe("isWorkerMessage", () => {
  it("returns true for shape with type and payload", () => {
    expect(isWorkerMessage({ type: "A", payload: { ok: true } })).toBe(true);
  });

  it("returns false for invalid payloads", () => {
    expect(isWorkerMessage(null)).toBe(false);
    expect(isWorkerMessage(undefined)).toBe(false);
    expect(isWorkerMessage({})).toBe(false);
    expect(isWorkerMessage({ type: "A" })).toBe(false);
  });
});
