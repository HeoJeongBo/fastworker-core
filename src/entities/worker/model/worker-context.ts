const workerGlobal = (globalThis as { self?: unknown }).self ?? globalThis;

export const ctx = workerGlobal as unknown as Worker;
