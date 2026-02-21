export type WorkerMessageMap = Record<string, unknown>;

export type WorkerMessage<TMap extends WorkerMessageMap, TType extends keyof TMap = keyof TMap> = {
  type: TType;
  payload: TMap[TType];
};

export type WorkerMessageUnion<TMap extends WorkerMessageMap> = {
  [K in keyof TMap]: WorkerMessage<TMap, K>;
}[keyof TMap];

export const isWorkerMessage = <TMap extends WorkerMessageMap>(
  value: unknown,
): value is WorkerMessageUnion<TMap> => {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!("type" in value) || !("payload" in value)) {
    return false;
  }

  return true;
};
