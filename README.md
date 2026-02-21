# @heojeongbo/fastworker-core

A browser-worker-first core library for reusable data structures and worker communication primitives.

## Scope

- Runtime: Browser `Web Worker`
- Frontend usage: `Vite`, `Next.js` client components, other bundlers
- Not targeted: server runtime / SSR execution path

## Architecture

This repository now follows an FSD-style structure:

- `src/shared/lib/*`: framework-agnostic low-level utilities and data structures
- `src/entities/worker/*`: worker communication model (`ctx`, pub/sub, transfer helpers)
- `src/features/worker-timer/*`: worker timer skeleton feature

## Installation

```bash
bun add @heojeongbo/fastworker-core
```

## Core Structures

### `RingBuffer<T>`

```ts
import { RingBuffer } from '@heojeongbo/fastworker-core';

const buffer = new RingBuffer<number>(3);
buffer.push(1);
buffer.push(2);
buffer.push(3);
buffer.push(4);

buffer.toArray(); // [2, 3, 4]
```

### `TimeSeriesBuffer`

File name: `time-series-buffer.ts`.

```ts
import { TimeSeriesBuffer } from '@heojeongbo/fastworker-core';

const series = new TimeSeriesBuffer(1024, 2);
series.push(performance.now(), new Uint32Array([120, 80]));
```

Backward-compatible alias is also exported as `TimeSereiseBuffer`.

## Worker Base Skeleton

The package provides the worker base pattern with the requested context style:

```ts
import { ctx, WorkerPubSub } from '@heojeongbo/fastworker-core';

const workerCtx = ctx; // const ctx = self as unknown as Worker;
const bus = new WorkerPubSub<{ tick: Uint32Array }>(workerCtx);

bus.emitTransferable('tick', new Uint32Array([1]));
```

### Transferable Strategy

- Uses transferable `ArrayBuffer`/typed-array buffers for high throughput
- Excludes `SharedArrayBuffer` by design
- Avoids duplicate buffer transfer in one payload

## Generic Worker Protocol

You can model your worker communication (like your sensor worker/client code) with generic maps.

```ts
type Inbound = {
  APPEND_SAMPLE: { streamId: string; timestamp: number; values: number[] };
  QUERY_RANGE: { streamId: string; from: number; to: number };
  COMPUTE_AGGREGATION: { streamId: string; metric: 'min' | 'max' | 'avg' };
  RESET: undefined;
};

type Outbound = {
  RANGE_RESULT: { streamId: string; points: Array<{ timestamp: number; value: number }> };
  AGGREGATION_RESULT: { streamId: string; metric: 'min' | 'max' | 'avg'; value: number };
  ERROR: { message: string };
};
```

### Worker Side (`ctx` + kernel)

```ts
import { createWorkerKernel, ctx } from '@heojeongbo/fastworker-core';

const kernel = createWorkerKernel<Inbound, Outbound, { cache: unknown[] }>({
  ctx,
  initialState: { cache: [] },
  onError: (error, api) => {
    api.emit('ERROR', { message: (error as Error).message });
  },
});

kernel.on('RESET', (_, api) => {
  api.setState({ cache: [] });
});

kernel.listen();
```

### Main Thread Side (generic client)

```ts
import SensorWorker from './sensor-worker?worker';
import { createWorkerClientSingleton } from '@heojeongbo/fastworker-core';

const getSensorWorkerClient = createWorkerClientSingleton<Inbound, Outbound>(
  () => new SensorWorker(),
);

const client = getSensorWorkerClient();
client.post('QUERY_RANGE', { streamId: 'joint-1', from: 0, to: Date.now() });
client.on('RANGE_RESULT', (payload) => {
  console.log(payload.points);
});
```

## Binary Encode/Decode (Generic)

If payloads are already typed arrays or protobuf bytes, keep them binary.  
If payloads are plain objects, binary conversion is useful only when message volume is high enough to justify encode/decode overhead.

- Good fit for binary conversion:
- High-frequency messages (for example, 60Hz+ across many streams)
- Large payloads that cause noticeable GC pressure
- Stable schema where codec management is acceptable

- Keep plain objects when:
- Message rate is low/medium
- Payload size is small
- Simpler debugging is more important than max throughput

You can use generic codec helpers:

```ts
import {
  createJsonPayloadCodec,
  decodeBinaryMessage,
  encodeBinaryMessage,
  type PayloadCodecMap,
} from '@heojeongbo/fastworker-core';

type Inbound = {
  APPEND_SAMPLE: { streamId: string; timestamp: number; values: number[] };
  RESET: undefined;
};

const codecs: PayloadCodecMap<Inbound> = {
  APPEND_SAMPLE: createJsonPayloadCodec<Inbound['APPEND_SAMPLE']>(),
  RESET: createJsonPayloadCodec<Inbound['RESET']>(),
};

const encoded = encodeBinaryMessage<Inbound, 'APPEND_SAMPLE'>(
  { type: 'APPEND_SAMPLE', payload: { streamId: 's1', timestamp: 1, values: [1, 2] } },
  codecs,
);

const decoded = decodeBinaryMessage<Inbound, 'APPEND_SAMPLE'>(encoded, codecs);
```

## Input Normalization Boundary

You can accept multiple external input shapes while keeping one internal worker format.

```text
External Input
  ├─ JS object
  ├─ Uint8Array (protobuf/binary)
  └─ TypedArray

      ↓ normalize at worker boundary

Worker Internal
  → single TypedArray format

      ↓ project at output boundary

Worker Output
  ├─ object
  └─ typed
```

Use `createWorkerDataBridge`:

```ts
import { createWorkerDataBridge } from '@heojeongbo/fastworker-core';

const bridge = createWorkerDataBridge<{ values: number[] }, Uint32Array>({
  internalCtor: Uint32Array,
  objectToInternal: (input) => Uint32Array.from(input.values),
  internalToObject: (input) => ({ values: Array.from(input) }),
  outputTransform: ({ object }) => ({
    count: object.values.length,
    last: object.values[object.values.length - 1] ?? 0,
  }),
});

const internalFromObject = bridge.toInternal({ values: [1, 2, 3] });
const internalFromBinary = bridge.toInternal(new Uint8Array(new Uint32Array([4, 5]).buffer));
const internalFromTyped = bridge.toInternal(new Float32Array([6, 7, 8]));

const asObject = bridge.toOutput(internalFromObject, "object");
const asTyped = bridge.toOutput(internalFromTyped, "typed");
const asCustom = bridge.toOutput(internalFromBinary); // uses outputTransform
```

## Worker Timer Feature Skeleton

`WorkerTimerSkeleton` is included as a starting point for the timer architecture pattern:

- `start(intervalMs)`
- `stop()`
- `bindDefaultParser()` for `{ event, payload }` messages
- Emits transfer-based tick snapshots

## Tooling

- Package manager: `bun`
- Build: `rollup`
- Lint/format: `biome`
- Release: `release-it`
- Git hooks: `husky` (`pre-commit` -> `bun run check`)

## Development

```bash
bun install
bun run check
bun run lint
bun run test
bun run build
```

## Example

Vite + React worker example lives in `example/vite`.
It includes:
- `WorkerTimerSkeleton` start/stop flow
- Complex normalize flow with mixed inbound input types (`object`, `typed`, `binary`)
- Mixed outbound result types from worker (`object`, `typed`, `binary`, `analytics`)

```bash
bun run example:vite:dev
```

## Release

```bash
bun run release
```

Configuration: `.release-it.json`

## License

MIT
