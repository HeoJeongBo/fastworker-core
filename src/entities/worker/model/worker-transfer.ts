const hasCtor = (name: string): boolean =>
  typeof (globalThis as Record<string, unknown>)[name] === "function";

const isSharedArrayBuffer = (value: unknown): value is SharedArrayBuffer => {
  if (!hasCtor("SharedArrayBuffer")) {
    return false;
  }

  return value instanceof SharedArrayBuffer;
};

const isTransferableObject = (value: unknown): value is Transferable => {
  if (value == null || typeof value !== "object") {
    return false;
  }

  if (value instanceof ArrayBuffer) {
    return !isSharedArrayBuffer(value);
  }

  if (typeof MessagePort !== "undefined" && value instanceof MessagePort) {
    return true;
  }

  if (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) {
    return true;
  }

  if (typeof OffscreenCanvas !== "undefined" && value instanceof OffscreenCanvas) {
    return true;
  }

  return false;
};

const pushTransferable = (
  value: unknown,
  transfer: Transferable[],
  seen: Set<ArrayBuffer>,
): void => {
  if (value instanceof ArrayBuffer) {
    if (!isSharedArrayBuffer(value) && !seen.has(value)) {
      seen.add(value);
      transfer.push(value);
    }

    return;
  }

  if (ArrayBuffer.isView(value)) {
    const buffer = value.buffer;

    if (!isSharedArrayBuffer(buffer) && !seen.has(buffer)) {
      seen.add(buffer);
      transfer.push(buffer);
    }

    return;
  }

  if (isTransferableObject(value)) {
    transfer.push(value);
  }
};

export const collectTransferables = (payload: unknown): Transferable[] => {
  const transfer: Transferable[] = [];
  const queue: unknown[] = [payload];
  const visited = new Set<object>();
  const seenBuffers = new Set<ArrayBuffer>();

  while (queue.length > 0) {
    const current = queue.shift();

    pushTransferable(current, transfer, seenBuffers);

    if (current == null || typeof current !== "object") {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i += 1) {
        queue.push(current[i]);
      }

      continue;
    }

    for (const value of Object.values(current)) {
      queue.push(value);
    }
  }

  return transfer;
};

export const postTransferMessage = (workerCtx: Worker, payload: unknown): void => {
  const transfer = collectTransferables(payload);
  workerCtx.postMessage(payload, transfer);
};
