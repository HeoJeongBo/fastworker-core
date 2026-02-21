import { WorkerTimerSkeleton, ctx } from "@heojeongbo/fastworker-core";

type TimerTickView = {
  date: string;
  duration: number;
};

let startedAt = Date.now();

const pad = (value: number): string => String(value).padStart(2, "0");

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

const timer = new WorkerTimerSkeleton<TimerTickView>(
  60,
  1,
  () => {
    const value = Math.floor(Math.random() * 100);
    return new Uint32Array([value]);
  },
  () => {
    const now = Date.now();
    return {
      date: formatDate(now),
      duration: Math.max(0, Math.floor((now - startedAt) / 1000)),
    };
  },
);

ctx.addEventListener("message", (event: MessageEvent<{ event?: string }>) => {
  if (event.data?.event === "start") {
    startedAt = Date.now();
  }
});

timer.bindDefaultParser();
ctx.postMessage({
  event: "stopped",
  payload: undefined,
});
