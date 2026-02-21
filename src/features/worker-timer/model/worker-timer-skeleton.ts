import { WorkerPubSub, ctx } from "../../../entities/worker";
import { TimeSeriesBuffer } from "../../../shared/lib/time-series-buffer";

export interface WorkerTimerInboundEvents {
  start: { intervalMs: number };
  stop: undefined;
}

export interface WorkerTimerTickSnapshot {
  size: number;
  head: number;
  timestamps: Float64Array;
  values: Uint32Array[];
}

export interface WorkerTimerOutboundEvents<TTickPayload = WorkerTimerTickSnapshot> {
  started: { intervalMs: number };
  stopped: undefined;
  tick: TTickPayload;
}

export class WorkerTimerSkeleton<TTickPayload = WorkerTimerTickSnapshot> {
  private readonly channel = new WorkerPubSub<WorkerTimerOutboundEvents<TTickPayload>>(ctx);
  private readonly buffer: TimeSeriesBuffer;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;

  constructor(
    capacity: number,
    seriesCount: number,
    private readonly valueFactory: (tick: number) => Uint32Array,
    private readonly projectTick?: (snapshot: WorkerTimerTickSnapshot) => TTickPayload,
  ) {
    this.buffer = new TimeSeriesBuffer(capacity, seriesCount);
  }

  start(intervalMs: number): void {
    this.stop();

    this.timerId = setInterval(() => {
      this.tickCount += 1;
      this.buffer.push(performance.now(), this.valueFactory(this.tickCount));
      this.emitTick();
    }, intervalMs);

    this.channel.emit("started", { intervalMs });
  }

  stop(): void {
    if (this.timerId == null) {
      return;
    }

    clearInterval(this.timerId);
    this.timerId = null;
    this.channel.emit("stopped", undefined);
  }

  bindDefaultParser(): void {
    (ctx as unknown as DedicatedWorkerGlobalScope).addEventListener(
      "message",
      (event: MessageEvent<unknown>) => {
        const data = event.data as { event?: keyof WorkerTimerInboundEvents; payload?: unknown };

        if (data.event === "start") {
          const payload = data.payload as WorkerTimerInboundEvents["start"];
          this.start(payload.intervalMs);
        }

        if (data.event === "stop") {
          this.stop();
        }
      },
    );
  }

  private emitTick(): void {
    const snapshot = this.buffer.snapshot();

    // Create transferable snapshots. Buffers are detached after postMessage.
    const timestamps = snapshot.timestamps.slice(0);
    const values = snapshot.values.map((series) => series.slice(0));
    const tickSnapshot: WorkerTimerTickSnapshot = {
      size: snapshot.size,
      head: snapshot.head,
      timestamps,
      values,
    };
    const payload = this.projectTick
      ? this.projectTick(tickSnapshot)
      : (tickSnapshot as TTickPayload);

    this.channel.emitTransferable("tick", payload);
  }
}
