import { type WorkerMessageMap, type WorkerMessageUnion, isWorkerMessage } from "./worker-message";
import { postTransferMessage } from "./worker-transfer";

type AsyncOrSync = void | Promise<void>;

export interface WorkerKernelApi<TOutbound extends WorkerMessageMap, TState> {
  ctx: Worker;
  getState: () => TState;
  setState: (nextState: TState) => void;
  emit: <TType extends keyof TOutbound>(type: TType, payload: TOutbound[TType]) => void;
  emitTransferable: <TType extends keyof TOutbound>(type: TType, payload: TOutbound[TType]) => void;
}

export type WorkerMessageHandler<
  TInbound extends WorkerMessageMap,
  TOutbound extends WorkerMessageMap,
  TState,
  TType extends keyof TInbound,
> = (payload: TInbound[TType], api: WorkerKernelApi<TOutbound, TState>) => AsyncOrSync;

interface WorkerKernelOptions<TOutbound extends WorkerMessageMap, TState> {
  ctx: Worker;
  initialState: TState;
  onError?: (error: unknown, api: WorkerKernelApi<TOutbound, TState>) => void;
}

export class WorkerKernel<
  TInbound extends WorkerMessageMap,
  TOutbound extends WorkerMessageMap,
  TState,
> {
  private state: TState;
  private readonly handlers = new Map<
    keyof TInbound,
    WorkerMessageHandler<TInbound, TOutbound, TState, keyof TInbound>
  >();

  private readonly api: WorkerKernelApi<TOutbound, TState>;

  constructor(private readonly options: WorkerKernelOptions<TOutbound, TState>) {
    this.state = options.initialState;

    this.api = {
      ctx: options.ctx,
      getState: () => this.state,
      setState: (nextState) => {
        this.state = nextState;
      },
      emit: (type, payload) => {
        this.options.ctx.postMessage({ type, payload });
      },
      emitTransferable: (type, payload) => {
        postTransferMessage(this.options.ctx, { type, payload });
      },
    };
  }

  on<TType extends keyof TInbound>(
    type: TType,
    handler: WorkerMessageHandler<TInbound, TOutbound, TState, TType>,
  ): this {
    this.handlers.set(
      type,
      handler as WorkerMessageHandler<TInbound, TOutbound, TState, keyof TInbound>,
    );
    return this;
  }

  emit<TType extends keyof TOutbound>(type: TType, payload: TOutbound[TType]): void {
    this.api.emit(type, payload);
  }

  emitTransferable<TType extends keyof TOutbound>(type: TType, payload: TOutbound[TType]): void {
    this.api.emitTransferable(type, payload);
  }

  getState(): TState {
    return this.state;
  }

  listen(): void {
    this.options.ctx.addEventListener("message", (event: MessageEvent<unknown>) => {
      const data = event.data;

      if (!isWorkerMessage<TInbound>(data)) {
        return;
      }

      const typedMessage = data as WorkerMessageUnion<TInbound>;
      const handler = this.handlers.get(typedMessage.type as keyof TInbound);

      if (!handler) {
        return;
      }

      void Promise.resolve(
        handler(typedMessage.payload as TInbound[keyof TInbound], this.api),
      ).catch((error: unknown) => {
        if (this.options.onError) {
          this.options.onError(error, this.api);
        }
      });
    });
  }
}

export const createWorkerKernel = <
  TInbound extends WorkerMessageMap,
  TOutbound extends WorkerMessageMap,
  TState,
>(
  options: WorkerKernelOptions<TOutbound, TState>,
): WorkerKernel<TInbound, TOutbound, TState> => {
  return new WorkerKernel(options);
};
