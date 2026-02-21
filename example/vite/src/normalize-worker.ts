import {
  createWorkerDataBridge,
  ctx,
} from "@heojeongbo/fastworker-core";

import type {
  MotionAnalytics,
  MotionSample,
  NormalizeInput,
  NormalizeRequest,
  NormalizeResponse,
  NormalizeResponseKind,
} from "./normalize-types";

type NormalizeWorkerInboundMessage = {
  event: "normalize";
  payload: NormalizeRequest;
};

const JOINT_CAPACITY = 2;
const MOTION_VECTOR_LENGTH = 12;

const motionBridge = createWorkerDataBridge<MotionSample, Float32Array, MotionAnalytics>({
  internalCtor: Float32Array,
  objectToInternal: (input) => {
    const joints = Array.from({ length: JOINT_CAPACITY }, (_, index) => {
      return input.joints[index] ?? { x: 0, y: 0, z: 0, confidence: 0 };
    });

    const flattenedJoints = joints.flatMap((joint) => [joint.x, joint.y, joint.z, joint.confidence]);

    return new Float32Array([
      input.sessionId,
      input.timestampMs,
      ...flattenedJoints,
      input.battery.level,
      input.battery.charging,
    ]);
  },
  internalToObject: (input) => {
    return {
      sessionId: input[0] ?? 0,
      timestampMs: input[1] ?? 0,
      joints: [
        {
          x: input[2] ?? 0,
          y: input[3] ?? 0,
          z: input[4] ?? 0,
          confidence: input[5] ?? 0,
        },
        {
          x: input[6] ?? 0,
          y: input[7] ?? 0,
          z: input[8] ?? 0,
          confidence: input[9] ?? 0,
        },
      ],
      battery: {
        level: input[10] ?? 0,
        charging: (input[11] ?? 0) >= 0.5 ? 1 : 0,
      },
    };
  },
  outputTransform: ({ object }) => {
    const jointMagnitudes = object.joints.map((joint) =>
      Number(Math.hypot(joint.x, joint.y, joint.z).toFixed(3)),
    );
    const avgConfidence =
      object.joints.reduce((sum, joint) => sum + joint.confidence, 0) /
      Math.max(1, object.joints.length);

    return {
      sessionId: object.sessionId,
      timestampMs: object.timestampMs,
      avgConfidence: Number(avgConfidence.toFixed(3)),
      jointMagnitudes,
      batteryLevel: object.battery.level,
      charging: object.battery.charging === 1,
    };
  },
});

const normalizeMotionInput = (input: NormalizeInput): Float32Array => {
  const internal = motionBridge.toInternal(input.data);

  if (internal.length !== MOTION_VECTOR_LENGTH) {
    throw new Error(
      `Expected normalized vector length ${MOTION_VECTOR_LENGTH}, received ${internal.length}`,
    );
  }

  return internal;
};

const selectNormalizedPayload = (
  kind: NormalizeResponseKind,
  payload: {
    object: MotionSample;
    typed: Float32Array;
    binary: Uint8Array;
    analytics: MotionAnalytics;
  },
): NormalizeResponse["selected"] => {
  if (kind === "typed") {
    return payload.typed;
  }

  if (kind === "binary") {
    return payload.binary;
  }

  if (kind === "analytics") {
    return payload.analytics;
  }

  return payload.object;
};

ctx.addEventListener("message", (event: MessageEvent<NormalizeWorkerInboundMessage>) => {
  if (event.data.event !== "normalize") {
    return;
  }

  const payload = event.data.payload;

  try {
    const normalized = normalizeMotionInput(payload.input);
    const object = motionBridge.toObject(normalized);
    const typed = motionBridge.toTyped(normalized);
    const binary = motionBridge.toBinary(normalized);
    const analytics = motionBridge.toOutput(normalized) as MotionAnalytics;

    const response: NormalizeResponse = {
      requestId: payload.requestId,
      sourceKind: payload.input.kind,
      responseKind: payload.responseKind,
      selected: selectNormalizedPayload(payload.responseKind, {
        object,
        typed,
        binary,
        analytics,
      }),
      object,
      typed,
      binary,
      analytics,
    };

    ctx.postMessage({
      event: "normalized",
      payload: response,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown normalize error";
    ctx.postMessage({
      event: "normalizeError",
      payload: {
        requestId: payload?.requestId ?? "unknown",
        message,
      },
    });
  }
});
