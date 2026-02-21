import { describe, expect, it } from "vitest";

import { collectTransferables } from "../src/entities/worker";

describe("collectTransferables", () => {
  it("collects typed-array buffers once", () => {
    const typed = new Uint32Array([1, 2, 3]);

    const transferables = collectTransferables({
      a: typed,
      b: typed,
      nested: [typed],
    });

    expect(transferables).toHaveLength(1);
    expect(transferables[0]).toBe(typed.buffer);
  });

  it("excludes SharedArrayBuffer-backed views when available", () => {
    if (typeof SharedArrayBuffer === "undefined") {
      return;
    }

    const shared = new SharedArrayBuffer(32);
    const typed = new Uint32Array(shared);

    const transferables = collectTransferables({ typed });

    expect(transferables).toEqual([]);
  });
});
