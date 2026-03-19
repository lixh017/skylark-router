import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

const colors: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "var(--success-bg)", border: "var(--success)", icon: "var(--success-text)" },
  error:   { bg: "var(--danger-bg)",  border: "var(--danger)",  icon: "var(--danger-text)"  },
  warning: { bg: "var(--warning-bg)", border: "var(--warning)", icon: "var(--warning-text)" },
  info:    { bg: "var(--accent-bg)",  border: "var(--accent)",  icon: "var(--accent)"       },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{
        position: "fixed", top: 20, right: 20, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8,
        pointerEvents: "none",
      }}>
        {toasts.map((t) => {
          const c = colors[t.type];
          return (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10,
              background: "var(--surface)",
              border: `1px solid ${c.border}`,
              boxShadow: "var(--shadow-lg)",
              minWidth: 260, maxWidth: 380,
              pointerEvents: "all",
              animation: "toast-in 0.2s ease",
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                background: c.bg, color: c.icon,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {icons[t.type]}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: "var(--text)", lineHeight: 1.4 }}>
                {t.message}
              </span>
              <button onClick={() => remove(t.id)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", fontSize: 16, padding: "0 2px",
                lineHeight: 1, flexShrink: 0,
              }}>×</button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}
