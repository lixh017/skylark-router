import emptyImg from "../../assets/empty-state.png";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "48px 24px", textAlign: "center",
    }}>
      <img
        src={emptyImg}
        alt=""
        style={{ width: 160, height: "auto", opacity: 0.85, marginBottom: 20 }}
      />
      <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
        {title}
      </h3>
      {description && (
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {action && (
        <button onClick={action.onClick} style={{
          padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
        }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
