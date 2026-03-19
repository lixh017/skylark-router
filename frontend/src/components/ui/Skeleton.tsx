interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: number;
  style?: React.CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, radius = 6, style }: SkeletonProps) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "var(--surface-hover)",
      animation: "skeleton-pulse 1.5s ease-in-out infinite",
      ...style,
    }} />
  );
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 16, padding: "14px 0",
      borderBottom: "1px solid var(--border)",
    }}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height={14} width={i === 0 ? "60%" : "80%"} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div style={{
      padding: 16, borderRadius: 10,
      border: "1px solid var(--border)",
      background: "var(--surface)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Skeleton width={32} height={32} radius={8} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton height={14} width="50%" />
          <Skeleton height={12} width="30%" />
        </div>
      </div>
      <Skeleton height={12} />
      <Skeleton height={12} width="75%" />
    </div>
  );
}

export function SkeletonTable({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </div>
  );
}

// CSS 动画注入到 index.css 会更好，这里用 style tag 保持组件自包含
export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes skeleton-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    `}</style>
  );
}
