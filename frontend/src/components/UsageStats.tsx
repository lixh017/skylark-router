import { useEffect, useState } from "react";
import type { Stats } from "../types";
import { getStats, getTimeseries, type TimeseriesPoint } from "../api/client";
import { useI18n } from "../i18n";

export default function UsageStats() {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [timeRange, setTimeRange] = useState("24h");

  const load = () => {
    const hours = timeRange === "1h" ? 1 : timeRange === "24h" ? 24 : 168;
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const interval = timeRange === "7d" ? "1d" : "1h";
    getStats(since).then(setStats).catch(console.error);
    getTimeseries(since, interval).then(setTimeseries).catch(console.error);
  };

  useEffect(load, [timeRange]);

  if (!stats) return <div>{t.loading}</div>;

  const successRate = stats.total_requests > 0
    ? ((stats.success_requests / stats.total_requests) * 100).toFixed(1)
    : "\u2014";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t.usageStatistics}</h2>
        <div style={{ display: "flex", gap: 4 }}>
          {["1h", "24h", "7d"].map((r) => (
            <button key={r} onClick={() => setTimeRange(r)} style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 13, cursor: "pointer",
              background: timeRange === r ? "var(--accent)" : "var(--surface)",
              color: timeRange === r ? "var(--accent-text)" : "var(--text)",
              border: timeRange === r ? "none" : "1px solid var(--border)",
            }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <Card label={t.totalRequests} value={stats.total_requests} />
        <Card label={t.successRate} value={`${successRate}%`} />
        <Card label={t.avgLatency} value={`${stats.avg_latency.toFixed(0)}ms`} />
        <Card label={t.totalTokens} value={stats.total_tokens} />
      </div>
      {stats.total_cost_usd > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Card label={t.totalCost} value={`$${stats.total_cost_usd.toFixed(4)}`} />
        </div>
      )}

      {timeseries.length > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
          <ChartCard label="Requests">
            <BarChart
              data={timeseries.map((p) => p.requests)}
              overlayData={timeseries.map((p) => p.errors)}
              color="var(--accent)"
              overlayColor="var(--danger)"
            />
          </ChartCard>
          <ChartCard label="Avg Latency (ms)">
            <LineChart data={timeseries.map((p) => p.avg_latency)} color="var(--accent)" />
          </ChartCard>
          <ChartCard label="Tokens">
            <BarChart data={timeseries.map((p) => p.tokens)} color="var(--success)" />
          </ChartCard>
        </div>
      )}

      {stats.provider_stats && stats.provider_stats.length > 0 && (
        <>
          <h3>{t.byProvider}</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>{t.provider}</th>
                <th style={thStyle}>{t.requests}</th>
                <th style={thStyle}>{t.success}</th>
                <th style={thStyle}>{t.avgLatency}</th>
                <th style={thStyle}>{t.tokens}</th>
                <th style={thStyle}>{t.cost}</th>
              </tr>
            </thead>
            <tbody>
              {stats.provider_stats.map((ps) => (
                <tr key={ps.provider_name}>
                  <td style={tdStyle}>{ps.provider_name}</td>
                  <td style={tdStyle}>{ps.request_count}</td>
                  <td style={tdStyle}>{ps.success_count}/{ps.request_count}</td>
                  <td style={tdStyle}>{ps.avg_latency.toFixed(0)}ms</td>
                  <td style={tdStyle}>{ps.total_tokens}</td>
                  <td style={tdStyle}>{ps.cost_usd > 0 ? `$${ps.cost_usd.toFixed(4)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {stats.recent_requests && stats.recent_requests.length > 0 && (
        <>
          <h3>{t.recentRequests}</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>{t.time}</th>
                <th style={thStyle}>{t.model}</th>
                <th style={thStyle}>{t.provider}</th>
                <th style={thStyle}>{t.tokens}</th>
                <th style={thStyle}>{t.cost}</th>
                <th style={thStyle}>{t.latency}</th>
                <th style={thStyle}>{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_requests.map((r) => (
                <tr key={r.id}>
                  <td style={tdStyle}>{new Date(r.created_at).toLocaleTimeString()}</td>
                  <td style={tdStyle}>{r.model_name}</td>
                  <td style={tdStyle}>{r.provider_name}</td>
                  <td style={tdStyle}>{r.prompt_tokens + r.completion_tokens}</td>
                  <td style={tdStyle}>{r.cost_usd > 0 ? `$${r.cost_usd.toFixed(4)}` : "—"}</td>
                  <td style={tdStyle}>{r.latency}ms</td>
                  <td style={tdStyle}>
                    <span style={{ color: r.success ? "var(--success)" : "var(--danger)" }}>
                      {r.success ? "OK" : "FAIL"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      padding: 16, background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function ChartCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 16px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const CHART_W = 300;
const CHART_H = 64;
const CHART_PAD = 2;

function BarChart({ data, color, overlayData, overlayColor }: {
  data: number[]; color: string; overlayData?: number[]; overlayColor?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const n = data.length;
  const barW = (CHART_W - CHART_PAD * 2) / n;
  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: "100%", height: CHART_H, display: "block" }}>
      {data.map((v, i) => {
        const h = Math.max((v / max) * (CHART_H - CHART_PAD * 2), 1);
        const x = CHART_PAD + i * barW;
        const ov = overlayData ? overlayData[i] : 0;
        const oh = ov > 0 ? Math.max((ov / max) * (CHART_H - CHART_PAD * 2), 1) : 0;
        return (
          <g key={i}>
            <rect x={x + 1} y={CHART_H - CHART_PAD - h} width={Math.max(barW - 2, 1)} height={h} fill={color} opacity={0.7} rx={1} />
            {oh > 0 && <rect x={x + 1} y={CHART_H - CHART_PAD - oh} width={Math.max(barW - 2, 1)} height={oh} fill={overlayColor} opacity={0.85} rx={1} />}
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const n = data.length;
  const points = data.map((v, i) => {
    const x = CHART_PAD + (i / (n - 1)) * (CHART_W - CHART_PAD * 2);
    const y = CHART_H - CHART_PAD - Math.max((v / max) * (CHART_H - CHART_PAD * 2), 0);
    return `${x},${y}`;
  });
  const areaClose = `${CHART_W - CHART_PAD},${CHART_H - CHART_PAD} ${CHART_PAD},${CHART_H - CHART_PAD}`;
  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: "100%", height: CHART_H, display: "block" }}>
      <polygon points={`${points.join(" ")} ${areaClose}`} fill={color} opacity={0.15} />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "10px 12px", borderBottom: "2px solid var(--border)", fontSize: 13, color: "var(--text-muted)",
};
const tdStyle: React.CSSProperties = {
  padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: 14,
};
