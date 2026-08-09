import { useEffect, useState } from "react";

export interface Toast {
  id: number;
  message: string;
}

let nextId = 1;
type Listener = (toast: Toast) => void;
const listeners = new Set<Listener>();

/** Fire-and-forget: usable from anywhere (API client, dialogs) without needing a hook. */
export function showToast(message: string) {
  const toast: Toast = { id: nextId++, message };
  listeners.forEach((listener) => listener(toast));
}

const AUTO_DISMISS_MS = 6000;

/** Mount once near the app root. Renders whatever showToast() fires, anywhere in the tree. */
export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener: Listener = (toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, AUTO_DISMISS_MS);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className="blueprint toast" onClick={() => dismiss(t.id)}>
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
