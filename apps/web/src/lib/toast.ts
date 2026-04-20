// Minimal toast bus — no external lib, no React context gymnastics.
// `toast.success()` / `.error()` / `.info()` fire a window CustomEvent;
// the `<Toaster>` component (site-wide, mounted in root layout) subscribes
// and renders the transient notifications.

export type ToastKind = "success" | "error" | "info";

export interface ToastPayload {
  id: number;
  kind: ToastKind;
  message: string;
  // Auto-dismiss delay in ms. `null` = sticky (user must click ×).
  ttlMs: number | null;
}

const EVENT_NAME = "play:toast";
let counter = 0;

function emit(
  kind: ToastKind,
  message: string,
  ttlMs: number | null = 4000,
): void {
  if (typeof window === "undefined") return;
  const detail: ToastPayload = {
    id: ++counter,
    kind,
    message,
    ttlMs,
  };
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

export const toast = {
  success: (message: string, ttlMs: number | null = 3500) =>
    emit("success", message, ttlMs),
  error: (message: string, ttlMs: number | null = 6000) =>
    emit("error", message, ttlMs),
  info: (message: string, ttlMs: number | null = 4000) =>
    emit("info", message, ttlMs),
};

export const TOAST_EVENT = EVENT_NAME;
