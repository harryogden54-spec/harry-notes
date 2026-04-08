import React, { createContext, useContext, useState, useCallback, useRef } from "react";

export type ToastAction = { label: string; onPress: () => void };
export type ToastItem   = { id: string; message: string; action?: ToastAction };

type ToastContextValue = {
  showToast: (message: string, action?: ToastAction) => void;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

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

  return (
    <ToastContext.Provider value={{ showToast, toasts, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be within ToastProvider");
  return ctx;
}
