import { useState, useEffect, useCallback } from "react";
import type { RequestLog } from "../types";
import { listRequestLogs, getRequestLog, deleteRequestLogs } from "../api/client";
import { useI18n } from "../i18n";

export default function RequestLogs() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [modelFilter, setModelFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedLog, setExpandedLog] = useState<RequestLog | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listRequestLogs({
        page,
        limit,
        model: modelFilter || undefined,
      });
      setLogs(res.data || []);
      setTotal(res.total);
    } catch (e) {
      console.error("Failed to load request logs:", e);
    } finally {
      setLoading(false);
    }
  }, [page, limit, modelFilter]);

  useEffect(() => { load(); }, [load]);

  const handleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedLog(null);
      return;
    }
    try {
      const log = await getRequestLog(id);
      setExpandedId(id);
      setExpandedLog(log);
    } catch (e) {
      alert(t.failedLoadLogDetail + (e as Error).message);
    }
  };

  const handleCleanup = async () => {
    const days = prompt(t.deleteLogsPrompt, "7");
    if (!days) return;
    const d = parseInt(days);
    if (isNaN(d) || d < 1) return;
    const before = new Date(Date.now() - d * 86400000).toISOString();
    try {
      const result = await deleteRequestLogs(before);
      alert(t.deletedLogs(result.deleted));
      load();
    } catch (e) {
      alert(t.failedDeleteLogs + (e as Error).message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t.requestLogs}</h2>
        <button onClick={handleCleanup} style={btnStyle}>{t.cleanupOldLogs}</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={modelFilter}
          onChange={(e) => { setModelFilter(e.target.value); setPage(1); }}
          placeholder={t.filterByModel}
          style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, width: 250, background: "var(--bg)", color: "var(--text)" }}
        />
      </div>

      {loading ? (
        <p>{t.loading}</p>
      ) : logs.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>{t.noLogsFound}</p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                <th style={thStyle}>{t.time}</th>
                <th style={thStyle}>{t.model}</th>
                <th style={thStyle}>{t.provider}</th>
                <th style={thStyle}>{t.status}</th>
                <th style={thStyle}>{t.tokens}</th>
                <th style={thStyle}>{t.latency}</th>
                <th style={thStyle}>{t.details}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <>
                  <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={tdStyle}>{new Date(log.created_at).toLocaleString()}</td>
                    <td style={tdStyle}><strong>{log.model_name}</strong></td>
                    <td style={tdStyle}>{log.provider_name}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 12,
                        background: log.success ? "var(--success-bg)" : "var(--danger-bg)",
                        color: log.success ? "var(--success-text)" : "var(--danger-text)",
                      }}>
                        {log.status_code || (log.success ? "OK" : "ERR")}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {log.prompt_tokens + log.completion_tokens > 0
                        ? `${log.prompt_tokens}+${log.completion_tokens}`
                        : "\u2014"}
                    </td>
                    <td style={tdStyle}>{log.latency}ms</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => handleExpand(log.id)}
                        style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 14 }}
                      >
                        {expandedId === log.id ? t.hide : t.view}
                      </button>
                    </td>
                  </tr>
                  {expandedId === log.id && expandedLog && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={7} style={{ padding: 12, background: "var(--surface)" }}>
                        <div style={{ display: "flex", gap: 16 }}>
                          <div style={{ flex: 1 }}>
                            <strong>{t.requestBody}</strong>
                            <pre style={preStyle}>{expandedLog.request_body || "\u2014"}</pre>
                          </div>
                          <div style={{ flex: 1 }}>
                            <strong>{t.responseBody}</strong>
                            <pre style={preStyle}>{expandedLog.response_body || "\u2014"}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={pageBtn}>{t.prev}</button>
            <span style={{ padding: "6px 12px" }}>{t.pageInfo(page, totalPages, total)}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={pageBtn}>{t.next}</button>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 12px", fontSize: 13, color: "var(--text-muted)",
};
const tdStyle: React.CSSProperties = {
  padding: "8px 12px", fontSize: 14,
};
const preStyle: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6,
  padding: 8, fontSize: 12, maxHeight: 300, overflow: "auto",
  whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--text)",
};
const btnStyle: React.CSSProperties = {
  padding: "8px 16px", background: "var(--danger)", color: "#fff",
  border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14,
};
const pageBtn: React.CSSProperties = {
  padding: "6px 16px", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer",
  background: "var(--surface)", color: "var(--text)",
};
