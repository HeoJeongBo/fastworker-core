export type NumericTypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

export type WorkerOutputFormat = "typed" | "object";

export type WorkerExternalInput<TObject> = TObject | Uint8Array | NumericTypedArray;

interface NumericTypedArrayConstructor<TArray extends NumericTypedArray> {
  new (length: number): TArray;
  new (buffer: ArrayBufferLike, byteOffset?: number, length?: number): TArray;
  readonly BYTES_PER_ELEMENT: number;
}

interface CreateWorkerDataBridgeOptions<TObject, TInternal extends NumericTypedArray, TOutput> {
  internalCtor: NumericTypedArrayConstructor<TInternal>;
  objectToInternal: (input: TObject) => TInternal;
  internalToObject: (input: TInternal) => TObject;
  outputTransform?: (value: { typed: TInternal; object: TObject }) => TOutput;
}

interface WorkerDataBridge<TObject, TInternal extends NumericTypedArray, TOutput> {
  toInternal: (input: WorkerExternalInput<TObject>) => TInternal;
  toTyped: (internal: TInternal) => TInternal;
  toBinary: (internal: TInternal) => Uint8Array;
  toObject: (internal: TInternal) => TObject;
  toOutput: (internal: TInternal, format?: WorkerOutputFormat) => TOutput | TObject | TInternal;
}

const isNumericTypedArray = (value: unknown): value is NumericTypedArray => {
  if (!ArrayBuffer.isView(value) || value instanceof DataView) {
    return false;
  }

  return (
    value instanceof Int8Array ||
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray ||
    value instanceof Int16Array ||
    value instanceof Uint16Array ||
    value instanceof Int32Array ||
    value instanceof Uint32Array ||
    value instanceof Float32Array ||
    value instanceof Float64Array
  );
};

const cloneAsUint8Array = (value: ArrayBufferView): Uint8Array => {
  const source = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  const copy = new Uint8Array(source.length);
  copy.set(source);
  return copy;
};

export const createWorkerDataBridge = <
  TObject,
  TInternal extends NumericTypedArray,
  TOutput = never,
>(
  options: CreateWorkerDataBridgeOptions<TObject, TInternal, TOutput>,
): WorkerDataBridge<TObject, TInternal, TOutput> => {
  const { internalCtor, objectToInternal, internalToObject, outputTransform } = options;

  const toInternalFromBinary = (input: Uint8Array): TInternal => {
    if (input.byteLength % internalCtor.BYTES_PER_ELEMENT !== 0) {
      throw new Error(
        `Invalid binary payload length ${input.byteLength} for element size ${internalCtor.BYTES_PER_ELEMENT}`,
      );
    }

    const bytes = cloneAsUint8Array(input);
    return new internalCtor(bytes.buffer);
  };

  const toInternalFromTyped = (input: NumericTypedArray): TInternal => {
    const output = new internalCtor(input.length);
    output.set(input as unknown as ArrayLike<number>);
    return output;
  };

  const toInternal = (input: WorkerExternalInput<TObject>): TInternal => {
    if (input instanceof Uint8Array) {
      return toInternalFromBinary(input);
    }

    if (isNumericTypedArray(input)) {
      return toInternalFromTyped(input);
    }

    return objectToInternal(input as TObject);
  };

  const toTyped = (internal: TInternal): TInternal => {
    return internal.slice() as TInternal;
  };

  const toBinary = (internal: TInternal): Uint8Array => {
    return cloneAsUint8Array(internal);
  };

  const toObject = (internal: TInternal): TObject => {
    return internalToObject(internal);
  };

  const toOutput = (
    internal: TInternal,
    format: WorkerOutputFormat = "object",
  ): TOutput | TObject | TInternal => {
    const typed = toTyped(internal);
    const object = toObject(typed);

    if (outputTransform) {
      return outputTransform({ typed, object });
    }

    return format === "typed" ? typed : object;
  };

  return {
    toInternal,
    toTyped,
    toBinary,
    toObject,
    toOutput,
  };
};
