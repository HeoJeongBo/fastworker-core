import { describe, expect, it } from "vitest";

import {
  createJsonPayloadCodec,
  decodeBinaryMessage,
  decodeBinaryPayload,
  encodeBinaryMessage,
  encodeBinaryPayload,
  uint8ArrayCodec,
} from "../src/entities/worker";

describe("worker codec", () => {
  it("encodes and decodes payload with json codec", () => {
    const codec = createJsonPayloadCodec<{ id: string; count: number }>();

    const encoded = encodeBinaryPayload({ id: "a", count: 3 }, codec);
    const decoded = decodeBinaryPayload(encoded, codec);

    expect(decoded).toEqual({ id: "a", count: 3 });
  });

  it("encodes and decodes typed message with codec map", () => {
    type Inbound = {
      APPEND: { id: string; value: number };
      CLEAR: { id: string };
    };

    const codecs = {
      APPEND: createJsonPayloadCodec<Inbound["APPEND"]>(),
      CLEAR: createJsonPayloadCodec<Inbound["CLEAR"]>(),
    };

    const encoded = encodeBinaryMessage<Inbound, "APPEND">(
      { type: "APPEND", payload: { id: "sensor", value: 42 } },
      codecs,
    );

    const decoded = decodeBinaryMessage<Inbound, "APPEND">(encoded, codecs);

    expect(decoded).toEqual({ type: "APPEND", payload: { id: "sensor", value: 42 } });
  });

  it("passes through Uint8Array codec", () => {
    const raw = new Uint8Array([1, 2, 3]);

    const encoded = uint8ArrayCodec.encode(raw);
    const decoded = uint8ArrayCodec.decode(encoded);

    expect(decoded).toBe(raw);
  });
});
