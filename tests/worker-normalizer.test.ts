import { describe, expect, it } from "vitest";

import { createWorkerDataBridge } from "../src/entities/worker";

describe("worker data bridge", () => {
  const bridge = createWorkerDataBridge<{ values: number[] }, Uint32Array>({
    internalCtor: Uint32Array,
    objectToInternal: (input) => Uint32Array.from(input.values),
    internalToObject: (input) => ({ values: Array.from(input) }),
  });

  it("normalizes plain object to typed internal format", () => {
    const internal = bridge.toInternal({ values: [1, 2, 3] });

    expect(internal).toEqual(new Uint32Array([1, 2, 3]));
  });

  it("normalizes Uint8Array binary to typed internal format", () => {
    const source = new Uint32Array([10, 20, 30]);
    const binary = new Uint8Array(source.buffer);

    const internal = bridge.toInternal(binary);

    expect(internal).toEqual(new Uint32Array([10, 20, 30]));
  });

  it("normalizes typed array to internal typed format", () => {
    const internal = bridge.toInternal(new Float32Array([4, 5, 6]));

    expect(internal).toEqual(new Uint32Array([4, 5, 6]));
  });

  it("projects internal typed data to object/typed output", () => {
    const internal = new Uint32Array([7, 8, 9]);

    const asObject = bridge.toOutput(internal, "object");
    const asTyped = bridge.toOutput(internal, "typed");

    expect(asObject).toEqual({ values: [7, 8, 9] });
    expect(asTyped).toEqual(new Uint32Array([7, 8, 9]));
  });

  it("uses initialization output transform when provided", () => {
    const transformedBridge = createWorkerDataBridge<
      { values: number[] },
      Uint32Array,
      { total: number; length: number }
    >({
      internalCtor: Uint32Array,
      objectToInternal: (input) => Uint32Array.from(input.values),
      internalToObject: (input) => ({ values: Array.from(input) }),
      outputTransform: ({ typed }) => ({
        total: Array.from(typed).reduce((acc, value) => acc + value, 0),
        length: typed.length,
      }),
    });

    const result = transformedBridge.toOutput(new Uint32Array([3, 4, 5]));

    expect(result).toEqual({ total: 12, length: 3 });
  });

  it("throws when binary size does not match internal element size", () => {
    expect(() => bridge.toInternal(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
