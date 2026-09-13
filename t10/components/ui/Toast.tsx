"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clsx, uid } from "@/lib/utils";

type Tone = "neutral" | "error" | "success";
interface Toast {
  id: string;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<{ notify: (message: string, tone?: Tone) => void }>({
  notify: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: Tone = "neutral") => {
    const toast = { id: uid(), message, tone };
    setToasts((prev) => [...prev.slice(-2), toast]);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-4"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3200);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className={clsx(
        "pointer-events-auto max-w-md animate-fade-up rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur",
        toast.tone === "error"
          ? "border-danger/40 bg-danger/10 text-ink"
          : toast.tone === "success"
            ? "border-ok/40 bg-ok/10 text-ink"
            : "border-line-strong bg-raised/95 text-ink",
      )}
    >
      {toast.message}
    </div>
  );
}
