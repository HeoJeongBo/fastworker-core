export class RingBuffer<T> {
  private readonly buffer: (T | undefined)[];
  private readonly capacity: number;
  private head = 0;
  private size = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("RingBuffer capacity must be a positive integer");
    }

    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(value: T): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size += 1;
    }
  }

  toArray(): T[] {
    const result: T[] = [];

    for (let i = 0; i < this.size; i += 1) {
      const index = (this.head - this.size + i + this.capacity) % this.capacity;
      result.push(this.buffer[index] as T);
    }

    return result;
  }

  getSize(): number {
    return this.size;
  }

  isFull(): boolean {
    return this.size === this.capacity;
  }

  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.size = 0;
  }
}
