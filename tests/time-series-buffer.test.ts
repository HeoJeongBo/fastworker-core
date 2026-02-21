import { describe, expect, it } from "vitest";

import { TimeSeriesBuffer } from "../src/shared/lib/time-series-buffer";

describe("TimeSeriesBuffer", () => {
  it("stores timestamps and series values", () => {
    const buffer = new TimeSeriesBuffer(4, 2);

    buffer.push(1000, new Uint32Array([1, 10]));
    buffer.push(1010, new Uint32Array([2, 20]));

    const snapshot = buffer.snapshot();

    expect(snapshot.size).toBe(2);
    expect(snapshot.head).toBe(2);
    expect(snapshot.timestamps[0]).toBe(1000);
    expect(snapshot.timestamps[1]).toBe(1010);
    const firstSeries = snapshot.values[0];
    const secondSeries = snapshot.values[1];
    expect(firstSeries).toBeDefined();
    expect(secondSeries).toBeDefined();
    expect(firstSeries?.[0]).toBe(1);
    expect(secondSeries?.[1]).toBe(20);
  });

  it("keeps fixed capacity semantics", () => {
    const buffer = new TimeSeriesBuffer(2, 1);

    buffer.push(100, new Uint32Array([5]));
    buffer.push(200, new Uint32Array([6]));
    buffer.push(300, new Uint32Array([7]));

    const snapshot = buffer.snapshot();

    expect(snapshot.size).toBe(2);
    expect(snapshot.head).toBe(1);
    expect(snapshot.timestamps[0]).toBe(300);
    expect(snapshot.timestamps[1]).toBe(200);
    const firstSeries = snapshot.values[0];
    expect(firstSeries).toBeDefined();
    expect(firstSeries?.[0]).toBe(7);
    expect(firstSeries?.[1]).toBe(6);
  });

  it("throws when input length does not match series count", () => {
    const buffer = new TimeSeriesBuffer(4, 2);

    expect(() => buffer.push(1000, new Uint32Array([1]))).toThrow();
  });

  it("clears all data", () => {
    const buffer = new TimeSeriesBuffer(2, 2);

    buffer.push(100, new Uint32Array([1, 2]));
    buffer.clear();

    const snapshot = buffer.snapshot();

    expect(snapshot.size).toBe(0);
    expect(snapshot.head).toBe(0);
    expect(snapshot.timestamps[0]).toBe(0);
    const firstSeries = snapshot.values[0];
    const secondSeries = snapshot.values[1];
    expect(firstSeries).toBeDefined();
    expect(secondSeries).toBeDefined();
    expect(firstSeries?.[0]).toBe(0);
    expect(secondSeries?.[0]).toBe(0);
  });

  it("throws on invalid constructor values", () => {
    expect(() => new TimeSeriesBuffer(0, 1)).toThrow();
    expect(() => new TimeSeriesBuffer(1, 0)).toThrow();
  });
});
