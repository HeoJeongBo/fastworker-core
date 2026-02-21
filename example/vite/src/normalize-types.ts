export type MotionJoint = {
  x: number;
  y: number;
  z: number;
  confidence: number;
};

export type MotionSample = {
  sessionId: number;
  timestampMs: number;
  joints: MotionJoint[];
  battery: {
    level: number;
    charging: 0 | 1;
  };
};

export type MotionAnalytics = {
  sessionId: number;
  timestampMs: number;
  avgConfidence: number;
  jointMagnitudes: number[];
  batteryLevel: number;
  charging: boolean;
};

export type NormalizeInput =
  | { kind: "object"; data: MotionSample }
  | { kind: "typed"; data: Float32Array }
  | { kind: "binary"; data: Uint8Array };

export type NormalizeResponseKind = "object" | "typed" | "binary" | "analytics";

export type NormalizeRequest = {
  requestId: string;
  input: NormalizeInput;
  responseKind: NormalizeResponseKind;
};

export type NormalizeResponse = {
  requestId: string;
  sourceKind: NormalizeInput["kind"];
  responseKind: NormalizeResponseKind;
  selected: MotionSample | Float32Array | Uint8Array | MotionAnalytics;
  object: MotionSample;
  typed: Float32Array;
  binary: Uint8Array;
  analytics: MotionAnalytics;
};

export type NormalizeInboundEvents = {
  normalize: NormalizeRequest;
};

export type NormalizeOutboundEvents = {
  normalized: NormalizeResponse;
  normalizeError: {
    requestId: string;
    message: string;
  };
};
