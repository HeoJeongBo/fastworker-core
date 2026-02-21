import type { WorkerMessage, WorkerMessageMap } from "./worker-message";

export interface PayloadCodec<TPayload> {
  encode: (payload: TPayload) => Uint8Array;
  decode: (bytes: Uint8Array) => TPayload;
}

export type PayloadCodecMap<TMap extends WorkerMessageMap> = {
  [K in keyof TMap]: PayloadCodec<TMap[K]>;
};

export type BinaryWorkerMessage<TType extends PropertyKey = string> = {
  type: TType;
  payload: Uint8Array;
};

export const uint8ArrayCodec: PayloadCodec<Uint8Array> = {
  encode: (payload) => payload,
  decode: (bytes) => bytes,
};

export const createJsonPayloadCodec = <TPayload>(): PayloadCodec<TPayload> => {
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  return {
    encode: (payload: TPayload): Uint8Array => {
      return textEncoder.encode(JSON.stringify(payload));
    },
    decode: (bytes: Uint8Array): TPayload => {
      return JSON.parse(textDecoder.decode(bytes)) as TPayload;
    },
  };
};

export const encodeBinaryPayload = <TPayload>(
  payload: TPayload,
  codec: PayloadCodec<TPayload>,
): Uint8Array => {
  return codec.encode(payload);
};

export const decodeBinaryPayload = <TPayload>(
  payload: Uint8Array,
  codec: PayloadCodec<TPayload>,
): TPayload => {
  return codec.decode(payload);
};

export const encodeBinaryMessage = <TMap extends WorkerMessageMap, TType extends keyof TMap>(
  message: WorkerMessage<TMap, TType>,
  codecs: PayloadCodecMap<TMap>,
): BinaryWorkerMessage<TType> => {
  const codec = codecs[message.type];

  return {
    type: message.type,
    payload: codec.encode(message.payload),
  };
};

export const decodeBinaryMessage = <TMap extends WorkerMessageMap, TType extends keyof TMap>(
  message: BinaryWorkerMessage<TType>,
  codecs: PayloadCodecMap<TMap>,
): WorkerMessage<TMap, TType> => {
  const codec = codecs[message.type as keyof TMap] as unknown as PayloadCodec<TMap[TType]>;

  return {
    type: message.type,
    payload: codec.decode(message.payload),
  };
};
