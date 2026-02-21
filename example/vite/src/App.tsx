import type {
  WorkerTimerInboundEvents,
  WorkerTimerOutboundEvents,
} from "@heojeongbo/fastworker-core";
import { useEffect, useRef, useState } from "react";

import NormalizeWorker from "./normalize-worker?worker";
import TimerWorker from "./timer-worker?worker";
import type {
  MotionSample,
  NormalizeInboundEvents,
  NormalizeOutboundEvents,
  NormalizeResponse,
  NormalizeResponseKind,
} from "./normalize-types";

type TimerTickView = {
  date: string;
  duration: number;
};

type WorkerEventUnion<TEventMap extends object> = {
  [K in keyof TEventMap]: {
    event: K;
    payload: TEventMap[K];
  };
}[keyof TEventMap];

type TimerInboundMessage = WorkerEventUnion<WorkerTimerInboundEvents>;
type TimerOutboundMessage = WorkerEventUnion<WorkerTimerOutboundEvents<TimerTickView>>;
type NormalizeInboundMessage = WorkerEventUnion<NormalizeInboundEvents>;
type NormalizeOutboundMessage = WorkerEventUnion<NormalizeOutboundEvents>;
type SerializableExampleMessage =
  | TimerOutboundMessage
  | NormalizeOutboundMessage
  | NormalizeResponse
  | null;

const toSerializableJson = (value: SerializableExampleMessage): string => {
  return JSON.stringify(
    value,
    (_key, currentValue) => {
      if (ArrayBuffer.isView(currentValue) && !(currentValue instanceof DataView)) {
        return {
          typedArray: currentValue.constructor.name,
          length: currentValue.length,
          values: Array.from(currentValue as ArrayLike<number>),
        };
      }

      return currentValue;
    },
    2,
  );
};

const buildObjectInput = (): MotionSample => {
  const now = Date.now();

  return {
    sessionId: 23,
    timestampMs: now,
    joints: [
      {
        x: 12.2,
        y: 8.1,
        z: 3.7,
        confidence: 0.98,
      },
      {
        x: 9.4,
        y: 4.2,
        z: 6.5,
        confidence: 0.92,
      },
    ],
    battery: {
      level: 78,
      charging: 1,
    },
  };
};

const buildTypedInput = (): Float32Array => {
  const objectSample = buildObjectInput();
  const first = objectSample.joints[0] ?? { x: 0, y: 0, z: 0, confidence: 0 };
  const second = objectSample.joints[1] ?? { x: 0, y: 0, z: 0, confidence: 0 };

  return new Float32Array([
    objectSample.sessionId,
    objectSample.timestampMs,
    first.x,
    first.y,
    first.z,
    first.confidence,
    second.x,
    second.y,
    second.z,
    second.confidence,
    objectSample.battery.level,
    objectSample.battery.charging,
  ]);
};

const buildBinaryInput = (): Uint8Array => {
  const typed = buildTypedInput();
  const copiedBuffer = typed.buffer.slice(0);
  return new Uint8Array(copiedBuffer);
};

const createRequestId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}`;
};

export function App() {
  const timerWorkerRef = useRef<Worker | null>(null);
  const normalizeWorkerRef = useRef<Worker | null>(null);
  const [latestTimerMessage, setLatestTimerMessage] = useState<TimerOutboundMessage | null>(null);
  const [latestNormalize, setLatestNormalize] = useState<NormalizeResponse | null>(null);
  const [latestNormalizeError, setLatestNormalizeError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const timerWorker = new TimerWorker();
    const normalizeWorker = new NormalizeWorker();
    timerWorkerRef.current = timerWorker;
    normalizeWorkerRef.current = normalizeWorker;

    timerWorker.onmessage = (event: MessageEvent<TimerOutboundMessage>) => {
      console.log("[main] timer worker message:", event.data);
      setLatestTimerMessage(event.data);

      if (event.data.event === "started") {
        setRunning(true);
      }

      if (event.data.event === "stopped") {
        setRunning(false);
      }
    };

    normalizeWorker.onmessage = (event: MessageEvent<NormalizeOutboundMessage>) => {
      console.log("[main] normalize worker message:", event.data);

      if (event.data.event === "normalized") {
        setLatestNormalize(event.data.payload);
        setLatestNormalizeError(null);
      }

      if (event.data.event === "normalizeError") {
        setLatestNormalizeError(
          `${event.data.payload.requestId}: ${event.data.payload.message}`,
        );
      }
    };

    return () => {
      timerWorker.terminate();
      normalizeWorker.terminate();

      if (timerWorkerRef.current === timerWorker) {
        timerWorkerRef.current = null;
      }

      if (normalizeWorkerRef.current === normalizeWorker) {
        normalizeWorkerRef.current = null;
      }
    };
  }, []);

  const sendTimer = (message: TimerInboundMessage) => {
    timerWorkerRef.current?.postMessage(message);
  };

  const sendNormalize = (message: NormalizeInboundMessage) => {
    normalizeWorkerRef.current?.postMessage(message);
  };

  const start = () => {
    setRunning(true);
    sendTimer({ event: "start", payload: { intervalMs: 1000 } });
  };

  const stop = () => {
    setRunning(false);
    sendTimer({ event: "stop", payload: undefined });
  };

  const requestNormalize = (
    input: NormalizeInboundMessage["payload"]["input"],
    responseKind: NormalizeResponseKind,
  ) => {
    sendNormalize({
      event: "normalize",
      payload: {
        requestId: createRequestId(),
        input,
        responseKind,
      },
    });
  };

  return (
    <main style={{ fontFamily: "ui-sans-serif, system-ui", margin: "2rem", lineHeight: 1.5 }}>
      <h1>@heojeongbo/fastworker-core</h1>
      <p>Vite + React + Web Worker example (split workers)</p>

      <h2>Timer Worker</h2>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <button type="button" onClick={start} disabled={running}>
          Start Timer
        </button>
        <button type="button" onClick={stop} disabled={!running}>
          Stop Timer
        </button>
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <div>
          <strong>Date:</strong>{" "}
          {latestTimerMessage?.event === "tick" ? latestTimerMessage.payload.date : "-"}
        </div>
        <div>
          <strong>Duration:</strong>{" "}
          {latestTimerMessage?.event === "tick" ? `${latestTimerMessage.payload.duration}s` : "-"}
        </div>
      </div>

      <h2>Normalize Worker (object | typed | binary)</h2>
      <p style={{ marginTop: 0 }}>
        Send mixed input types to normalize worker and request object/typed/binary/analytics outputs.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <button
          type="button"
          onClick={() => requestNormalize({ kind: "object", data: buildObjectInput() }, "object")}
        >
          object -&gt; object
        </button>
        <button
          type="button"
          onClick={() => requestNormalize({ kind: "object", data: buildObjectInput() }, "analytics")}
        >
          object -&gt; analytics
        </button>
        <button
          type="button"
          onClick={() => requestNormalize({ kind: "typed", data: buildTypedInput() }, "typed")}
        >
          typed -&gt; typed
        </button>
        <button
          type="button"
          onClick={() => requestNormalize({ kind: "typed", data: buildTypedInput() }, "object")}
        >
          typed -&gt; object
        </button>
        <button
          type="button"
          onClick={() => requestNormalize({ kind: "binary", data: buildBinaryInput() }, "binary")}
        >
          binary -&gt; binary
        </button>
        <button
          type="button"
          onClick={() => requestNormalize({ kind: "binary", data: buildBinaryInput() }, "analytics")}
        >
          binary -&gt; analytics
        </button>
      </div>

      {latestNormalizeError ? (
        <p style={{ color: "#c0392b" }}>
          <strong>Normalize Error:</strong> {latestNormalizeError}
        </p>
      ) : null}

      <h3>Latest Normalize Result</h3>
      <pre
        style={{
          padding: "1rem",
          background: "#f5f5f5",
          borderRadius: "8px",
          minHeight: "220px",
          marginBottom: "1rem",
        }}
      >
        {latestNormalize === null
          ? "Click normalize buttons to test mixed input/output types..."
          : toSerializableJson(latestNormalize)}
      </pre>

      <h3>Latest Timer Message</h3>
      <pre
        style={{
          padding: "1rem",
          background: "#f5f5f5",
          borderRadius: "8px",
          minHeight: "220px",
        }}
      >
        {latestTimerMessage === null
          ? "Waiting for timer worker message..."
          : toSerializableJson(latestTimerMessage)}
      </pre>
    </main>
  );
}
