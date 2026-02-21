import { postTransferMessage } from "./worker-transfer";

type EventMapBase = object;
type Subscriber<T> = (payload: T) => void;

export class WorkerPubSub<TEventMap extends EventMapBase> {
  private readonly subscribers = new Map<keyof TEventMap, Set<Subscriber<unknown>>>();

  constructor(private readonly workerCtx: Worker) {}

  on<TKey extends keyof TEventMap>(
    event: TKey,
    subscriber: Subscriber<TEventMap[TKey]>,
  ): () => void {
    const current = this.subscribers.get(event) ?? new Set<Subscriber<unknown>>();
    current.add(subscriber as Subscriber<unknown>);
    this.subscribers.set(event, current);

    return () => {
      this.off(event, subscriber);
    };
  }

  off<TKey extends keyof TEventMap>(event: TKey, subscriber: Subscriber<TEventMap[TKey]>): void {
    const current = this.subscribers.get(event);

    if (!current) {
      return;
    }

    current.delete(subscriber as Subscriber<unknown>);

    if (current.size === 0) {
      this.subscribers.delete(event);
    }
  }

  publish<TKey extends keyof TEventMap>(event: TKey, payload: TEventMap[TKey]): void {
    const current = this.subscribers.get(event);

    if (!current) {
      return;
    }

    for (const subscriber of current) {
      subscriber(payload);
    }
  }

  emit<TKey extends keyof TEventMap>(event: TKey, payload: TEventMap[TKey]): void {
    this.workerCtx.postMessage({ event, payload });
  }

  emitTransferable<TKey extends keyof TEventMap>(event: TKey, payload: TEventMap[TKey]): void {
    postTransferMessage(this.workerCtx, { event, payload });
  }

  attachIncomingParser<TKey extends keyof TEventMap>(
    parser: (raw: MessageEvent<unknown>) => { event: TKey; payload: TEventMap[TKey] } | null,
  ): void {
    this.workerCtx.addEventListener("message", (event) => {
      const parsed = parser(event);

      if (!parsed) {
        return;
      }

      this.publish(parsed.event, parsed.payload);
    });
  }
}
