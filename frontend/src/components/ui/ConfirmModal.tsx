import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  const close = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          onClick={() => close(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
            animation: "fade-in 0.15s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: "24px 24px 20px",
              width: "100%", maxWidth: 400,
              boxShadow: "var(--shadow-lg)",
              animation: "modal-in 0.18s ease",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
              {state.title}
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              {state.message}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => close(false)} style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 14,
                border: "1px solid var(--border)",
                background: "transparent", color: "var(--text-secondary)",
                cursor: "pointer",
              }}>
                取消
              </button>
              <button onClick={() => close(true)} style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 500,
                border: "none",
                background: state.danger ? "var(--danger)" : "var(--accent)",
                color: "#fff",
                cursor: "pointer",
              }}>
                {state.confirmLabel ?? "确认"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fade-in  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.96) translateY(6px) } to { opacity: 1; transform: none } }
      `}</style>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}
