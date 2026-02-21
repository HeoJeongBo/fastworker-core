import { describe, expect, it } from "vitest";

import { WorkerClient, createWorkerKernel } from "../src/entities/worker";

class FakeWorker {
  public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();

  public readonly sent: unknown[] = [];

  addEventListener(type: string, callback: (event: MessageEvent<unknown>) => void): void {
    if (type === "message") {
      this.listeners.add(callback);
    }
  }

  postMessage(payload: unknown): void {
    this.sent.push(payload);
  }

  terminate(): void {
    this.listeners.clear();
    this.onmessage = null;
  }

  dispatchIncoming(data: unknown): void {
    const event = { data } as MessageEvent<unknown>;

    for (const callback of this.listeners) {
      callback(event);
    }

    if (this.onmessage) {
      this.onmessage(event);
    }
  }
}

describe("WorkerKernel + WorkerClient", () => {
  it("routes inbound messages to handlers and emits outbound messages", () => {
    type Inbound = {
      ADD: { value: number };
      RESET: undefined;
    };

    type Outbound = {
      UPDATED: { total: number };
      ERROR: { message: string };
    };

    const fake = new FakeWorker();

    const kernel = createWorkerKernel<Inbound, Outbound, { total: number }>({
      ctx: fake as unknown as Worker,
      initialState: { total: 0 },
      onError: (error, api) => {
        api.emit("ERROR", { message: (error as Error).message });
      },
    });

    kernel.on("ADD", ({ value }, api) => {
      const current = api.getState();
      const nextTotal = current.total + value;
      api.setState({ total: nextTotal });
      api.emit("UPDATED", { total: nextTotal });
    });

    kernel.on("RESET", (_, api) => {
      api.setState({ total: 0 });
      api.emit("UPDATED", { total: 0 });
    });

    kernel.listen();

    fake.dispatchIncoming({ type: "ADD", payload: { value: 3 } });
    fake.dispatchIncoming({ type: "ADD", payload: { value: 7 } });
    fake.dispatchIncoming({ type: "RESET", payload: undefined });

    expect(fake.sent).toEqual([
      { type: "UPDATED", payload: { total: 3 } },
      { type: "UPDATED", payload: { total: 10 } },
      { type: "UPDATED", payload: { total: 0 } },
    ]);
  });

  it("subscribes by message type on the generic client", () => {
    type Inbound = {
      START: { intervalMs: number };
    };

    type Outbound = {
      TICK: { count: number };
      STOPPED: undefined;
    };

    const fake = new FakeWorker();
    const client = new WorkerClient<Inbound, Outbound>(fake as unknown as Worker);

    const ticks: number[] = [];

    const unsubscribe = client.on("TICK", (payload) => {
      ticks.push(payload.count);
    });

    client.post("START", { intervalMs: 1000 });
    fake.dispatchIncoming({ type: "TICK", payload: { count: 1 } });
    fake.dispatchIncoming({ type: "TICK", payload: { count: 2 } });
    unsubscribe();
    fake.dispatchIncoming({ type: "TICK", payload: { count: 3 } });

    expect(fake.sent[0]).toEqual({ type: "START", payload: { intervalMs: 1000 } });
    expect(ticks).toEqual([1, 2]);
  });
});
