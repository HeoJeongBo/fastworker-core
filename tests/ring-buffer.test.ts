import { describe, expect, it } from "vitest";

import { RingBuffer } from "../src/shared/lib/ring-buffer";

describe("RingBuffer", () => {
  it("stores values in insertion order until capacity", () => {
    const buffer = new RingBuffer<number>(3);

    buffer.push(1);
    buffer.push(2);

    expect(buffer.toArray()).toEqual([1, 2]);
    expect(buffer.getSize()).toBe(2);
  });

  it("overwrites oldest values when full", () => {
    const buffer = new RingBuffer<number>(3);

    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4);

    expect(buffer.toArray()).toEqual([2, 3, 4]);
    expect(buffer.isFull()).toBe(true);
  });

  it("clears all values", () => {
    const buffer = new RingBuffer<number>(2);

    buffer.push(10);
    buffer.push(20);
    buffer.clear();

    expect(buffer.toArray()).toEqual([]);
    expect(buffer.getSize()).toBe(0);
  });

  it("throws on invalid capacity", () => {
    expect(() => new RingBuffer(0)).toThrow();
    expect(() => new RingBuffer(-1)).toThrow();
  });
});
