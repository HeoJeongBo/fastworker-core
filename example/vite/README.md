# Vite + React Example

This example demonstrates browser-only Web Worker usage with `@heojeongbo/fastworker-core` in a React app.

It includes:
- `WorkerTimerSkeleton` start/stop + tick rendering
- A normalize demo that sends mixed input types (`object`, `Float32Array`, `Uint8Array`)
- Mixed output selection (`object`, `typed`, `binary`, `analytics`) from worker

## Run

From the repository root:

```bash
bun run example:vite:dev
```

## Files

- `src/main.tsx`: React entry point
- `src/App.tsx`: UI controls for timer + normalize flows
- `src/timer-worker.ts`: timer-only worker (`WorkerTimerSkeleton`)
- `src/normalize-worker.ts`: normalize-only worker (`createWorkerDataBridge`)
- `src/normalize-types.ts`: shared normalize data/event types
