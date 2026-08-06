"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastKind = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  kind?: ToastKind;
  /** Optional action, e.g. Undo */
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

const ToastContext = React.createContext<{
  toast: (message: string, opts?: ToastOptions) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const icons: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="size-4 text-success" aria-hidden />,
  error: <AlertCircle className="size-4 text-danger" aria-hidden />,
  info: <Info className="size-4 text-[#1D5BD6]" aria-hidden />,
  warning: <AlertTriangle className="size-4 text-warning" aria-hidden />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const toast = React.useCallback((message: string, opts?: ToastOptions) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, kind: "info", ...opts }]);
    const duration = opts?.durationMs ?? 4000;
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "toast-in pointer-events-auto flex items-center gap-2.5 rounded-ctl border border-border bg-surface py-2.5 pl-3 pr-4 shadow-md"
            )}
          >
            {icons[t.kind ?? "info"]}
            <span className="text-small text-ink">{t.message}</span>
            {t.actionLabel && (
              <button
                onClick={() => {
                  t.onAction?.();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
                className="focus-ring text-small ml-1 font-semibold text-primary hover:text-primary-hover"
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
