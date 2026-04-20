"use client";

import { useEffect, useState } from "react";
import { TOAST_EVENT, type ToastPayload } from "@/lib/toast";

// Fixed-position toast container. Listens to the `play:toast` CustomEvent
// fired from anywhere via `toast.success(…)`. Auto-dismisses after the
// payload's TTL, or stays until the user clicks ×.

export function Toaster() {
  const [items, setItems] = useState<ToastPayload[]>([]);

  useEffect(() => {
    const onToast = (ev: Event) => {
      const t = (ev as CustomEvent<ToastPayload>).detail;
      setItems((cur) => [...cur, t]);
      if (t.ttlMs != null) {
        window.setTimeout(() => {
          setItems((cur) => cur.filter((x) => x.id !== t.id));
        }, t.ttlMs);
      }
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  function dismiss(id: number) {
    setItems((cur) => cur.filter((x) => x.id !== id));
  }

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-[min(360px,calc(100vw-3rem))] flex-col gap-2"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={
            "pointer-events-auto flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm shadow-[var(--shadow-card)] backdrop-blur-sm " +
            (t.kind === "success"
              ? "border-success/40 bg-success/10 text-foreground"
              : t.kind === "error"
                ? "border-danger/50 bg-danger/10 text-foreground"
                : "border-border-strong bg-surface text-foreground")
          }
        >
          <span
            aria-hidden
            className={
              "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold " +
              (t.kind === "success"
                ? "bg-success text-neutral-900"
                : t.kind === "error"
                  ? "bg-danger text-white"
                  : "bg-brand text-neutral-900")
            }
          >
            {t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "i"}
          </span>
          <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Schließen"
            className="shrink-0 rounded p-0.5 text-dim hover:text-foreground"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
