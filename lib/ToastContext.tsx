import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";

export type ToastAction = { label: string; onPress: () => void };
export type ToastItem   = { id: string; message: string; action?: ToastAction };

type ToastActions = {
  showToast: (message: string, action?: ToastAction) => void;
  dismissToast: (id: string) => void;
};

// State and actions are separate contexts: only ToastContainer reads the queue,
// while ~60 call sites only need showToast. Bundling them re-rendered every
// caller whenever a toast appeared or expired.
const ToastStateContext   = createContext<ToastItem[] | null>(null);
const ToastActionsContext = createContext<ToastActions | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismissToast = useCallback((id: string) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, action?: ToastAction) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-2), { id, message, action }]);
    timers.current[id] = setTimeout(() => dismissToast(id), 3500);
  }, [dismissToast]);

  const actions = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastActionsContext.Provider value={actions}>
      <ToastStateContext.Provider value={toasts}>
        {children}
      </ToastStateContext.Provider>
    </ToastActionsContext.Provider>
  );
}

/** Stable actions — safe to call from anywhere without re-render churn. */
export function useToast(): ToastActions {
  const ctx = useContext(ToastActionsContext);
  if (!ctx) throw new Error("useToast must be within ToastProvider");
  return ctx;
}

/** The live toast queue — consumed only by ToastContainer. */
export function useToastState(): ToastItem[] {
  const ctx = useContext(ToastStateContext);
  if (!ctx) throw new Error("useToastState must be within ToastProvider");
  return ctx;
}
