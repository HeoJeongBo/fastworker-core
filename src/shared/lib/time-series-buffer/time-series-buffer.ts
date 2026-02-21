export interface TimeSeriesSnapshot {
  timestamps: Float64Array;
  values: Uint32Array[];
  size: number;
  head: number;
}

export class TimeSeriesBuffer {
  readonly capacity: number;
  readonly seriesCount: number;

  private size = 0;
  private head = 0;

  readonly timestamps: Float64Array;
  readonly values: Uint32Array[];

  constructor(capacity: number, seriesCount: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("TimeSeriesBuffer capacity must be a positive integer");
    }

    if (!Number.isInteger(seriesCount) || seriesCount <= 0) {
      throw new Error("TimeSeriesBuffer seriesCount must be a positive integer");
    }

    this.capacity = capacity;
    this.seriesCount = seriesCount;

    this.timestamps = new Float64Array(capacity);
    this.values = Array.from({ length: seriesCount }, () => new Uint32Array(capacity));
  }

  push(timestamp: number, input: Uint32Array): void {
    if (input.length !== this.seriesCount) {
      throw new Error(`Expected input length ${this.seriesCount}, received ${input.length}`);
    }

    this.timestamps[this.head] = timestamp;

    for (let i = 0; i < this.seriesCount; i += 1) {
      const series = this.values[i];

      if (!series) {
        throw new Error(`Series index out of range: ${i}`);
      }

      series[this.head] = input[i] as number;
    }

    this.head = (this.head + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size += 1;
    }
  }

  snapshot(): TimeSeriesSnapshot {
    return {
      timestamps: this.timestamps,
      values: this.values,
      size: this.size,
      head: this.head,
    };
  }

  getSize(): number {
    return this.size;
  }

  clear(): void {
    this.timestamps.fill(0);

    for (let i = 0; i < this.seriesCount; i += 1) {
      const series = this.values[i];

      if (!series) {
        throw new Error(`Series index out of range: ${i}`);
      }

      series.fill(0);
    }

    this.size = 0;
    this.head = 0;
  }

  static create(capacity: number, seriesCount: number): TimeSeriesBuffer {
    return new TimeSeriesBuffer(capacity, seriesCount);
  }
}

// Backward-compatible alias.
export { TimeSeriesBuffer as TimeSereiseBuffer };
