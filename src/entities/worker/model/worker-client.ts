import {
  type WorkerMessage,
  type WorkerMessageMap,
  type WorkerMessageUnion,
  isWorkerMessage,
} from "./worker-message";

type Unsubscribe = () => void;

type WorkerConstructor = () => Worker;

export class WorkerClient<TInbound extends WorkerMessageMap, TOutbound extends WorkerMessageMap> {
  private readonly listeners = new Set<(message: WorkerMessageUnion<TOutbound>) => void>();

  private readonly typedListeners = new Map<
    keyof TOutbound,
    Set<(payload: TOutbound[keyof TOutbound], message: WorkerMessageUnion<TOutbound>) => void>
  >();

  constructor(private readonly worker: Worker) {
    this.worker.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;

      if (!isWorkerMessage<TOutbound>(data)) {
        return;
      }

      const typedMessage = data as WorkerMessageUnion<TOutbound>;

      for (const listener of this.listeners) {
        listener(typedMessage);
      }

      const scoped = this.typedListeners.get(typedMessage.type as keyof TOutbound);

      if (!scoped) {
        return;
      }

      for (const listener of scoped) {
        listener(typedMessage.payload as TOutbound[keyof TOutbound], typedMessage);
      }
    };
  }

  post<TType extends keyof TInbound>(type: TType, payload: TInbound[TType]): void {
    this.worker.postMessage({ type, payload });
  }

  postMessage(message: WorkerMessageUnion<TInbound>): void {
    this.worker.postMessage(message);
  }

  subscribe(listener: (message: WorkerMessageUnion<TOutbound>) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  on<TType extends keyof TOutbound>(
    type: TType,
    listener: (payload: TOutbound[TType], message: WorkerMessage<TOutbound, TType>) => void,
  ): Unsubscribe {
    const scoped =
      this.typedListeners.get(type) ??
      new Set<
        (payload: TOutbound[keyof TOutbound], message: WorkerMessageUnion<TOutbound>) => void
      >();

    const wrapped = (
      payload: TOutbound[keyof TOutbound],
      message: WorkerMessageUnion<TOutbound>,
    ): void => {
      listener(payload as TOutbound[TType], message as WorkerMessage<TOutbound, TType>);
    };

    scoped.add(wrapped);
    this.typedListeners.set(type, scoped);

    return () => {
      const current = this.typedListeners.get(type);

      if (!current) {
        return;
      }

      current.delete(wrapped);

      if (current.size === 0) {
        this.typedListeners.delete(type);
      }
    };
  }

  terminate(): void {
    this.listeners.clear();
    this.typedListeners.clear();
    this.worker.terminate();
  }
}

export const createWorkerClientSingleton = <
  TInbound extends WorkerMessageMap,
  TOutbound extends WorkerMessageMap,
>(
  factory: WorkerConstructor,
): (() => WorkerClient<TInbound, TOutbound>) => {
  let instance: WorkerClient<TInbound, TOutbound> | null = null;

  return (): WorkerClient<TInbound, TOutbound> => {
    if (!instance) {
      instance = new WorkerClient<TInbound, TOutbound>(factory());
    }

    return instance;
  };
};
