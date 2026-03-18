import { useState, useEffect, useCallback } from "react";
import type { APIKey } from "../types";
import { listAPIKeys, createAPIKey, updateAPIKey, deleteAPIKey, resetAPIKeyQuota } from "../api/client";
import { useI18n } from "../i18n";

export default function APIKeyList() {
  const { t } = useI18n();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editRateLimit, setEditRateLimit] = useState(0);
  const [editQuotaTotal, setEditQuotaTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      setKeys(await listAPIKeys());
    } catch (e) {
      console.error("Failed to load API keys:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    try {
      const key = await createAPIKey(newKeyName.trim());
      setCreatedKey(key.key || null);
      setNewKeyName("");
      load();
    } catch (e) {
      alert(t.failedCreateKey + (e as Error).message);
    }
  };

  const handleToggle = async (key: APIKey) => {
    try {
      await updateAPIKey(key.id, { enabled: !key.enabled });
      load();
    } catch (e) {
      alert(t.failedUpdateKey + (e as Error).message);
    }
  };

  const startEdit = (k: APIKey) => {
    setEditingId(k.id);
    setEditName(k.name);
    setEditRateLimit(k.rate_limit);
    setEditQuotaTotal(Number(k.quota_total));
  };

  const handleSave = async (id: number) => {
    try {
      await updateAPIKey(id, {
        name: editName,
        rate_limit: editRateLimit,
        quota_total: editQuotaTotal,
      });
      setEditingId(null);
      load();
    } catch (e) {
      alert(t.failedUpdateKey + (e as Error).message);
    }
  };

  const handleResetQuota = async (id: number) => {
    if (!confirm(t.resetQuotaConfirm)) return;
    try {
      await resetAPIKeyQuota(id);
      load();
    } catch (e) {
      alert(t.failedResetQuota + (e as Error).message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t.deleteKeyConfirm)) return;
    try {
      await deleteAPIKey(id);
      load();
    } catch (e) {
      alert(t.failedDeleteKey + (e as Error).message);
    }
  };

  if (loading) return <p>{t.loading}</p>;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{t.apiKeys}</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder={t.keyNamePlaceholder}
          style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", color: "var(--text)" }}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <button
          onClick={handleCreate}
          style={{ padding: "8px 16px", background: "var(--accent)", color: "var(--accent-text)", border: "none", borderRadius: 6, cursor: "pointer" }}
        >
          {t.createKey}
        </button>
      </div>

      {createdKey && (
        <div style={{ padding: 12, marginBottom: 16, background: "var(--success-bg)", border: "1px solid var(--success)", borderRadius: 6 }}>
          <strong>{t.newKeyBanner}</strong>
          <div style={{ fontFamily: "monospace", fontSize: 14, marginTop: 8, wordBreak: "break-all", userSelect: "all" }}>
            {createdKey}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(createdKey); }}
            style={{ marginTop: 8, marginRight: 8, padding: "4px 12px", cursor: "pointer", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", color: "var(--text)" }}
          >
            {t.copy}
          </button>
          <button
            onClick={() => setCreatedKey(null)}
            style={{ marginTop: 8, padding: "4px 12px", cursor: "pointer", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", color: "var(--text)" }}
          >
            {t.dismiss}
          </button>
        </div>
      )}

      {keys.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>{t.noKeysConfigured}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>{t.name}</th>
              <th style={{ padding: "8px 12px" }}>{t.key}</th>
              <th style={{ padding: "8px 12px" }}>{t.enabled}</th>
              <th style={{ padding: "8px 12px" }}>{t.rateLimit}</th>
              <th style={{ padding: "8px 12px" }}>{t.quota}</th>
              <th style={{ padding: "8px 12px" }}>{t.created}</th>
              <th style={{ padding: "8px 12px" }}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 12px" }}>
                  {editingId === k.id ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4, width: 120, background: "var(--bg)", color: "var(--text)" }} />
                  ) : k.name}
                </td>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "var(--text-muted)" }}>{k.key_suffix}</td>
                <td style={{ padding: "8px 12px" }}>
                  <button onClick={() => handleToggle(k)} style={{
                    padding: "2px 10px", border: "1px solid", borderRadius: 4, cursor: "pointer",
                    background: k.enabled ? "var(--success-bg)" : "var(--danger-bg)",
                    borderColor: k.enabled ? "var(--success)" : "var(--danger)",
                    color: k.enabled ? "var(--success-text)" : "var(--danger-text)",
                  }}>
                    {k.enabled ? t.yes : t.no}
                  </button>
                </td>
                <td style={{ padding: "8px 12px" }}>
                  {editingId === k.id ? (
                    <input type="number" value={editRateLimit} onChange={(e) => setEditRateLimit(Number(e.target.value))}
                      style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4, width: 80, background: "var(--bg)", color: "var(--text)" }} min={0} />
                  ) : (
                    <span>{k.rate_limit > 0 ? `${k.rate_limit}${t.perMin}` : t.unlimited}</span>
                  )}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  {editingId === k.id ? (
                    <input type="number" value={editQuotaTotal} onChange={(e) => setEditQuotaTotal(Number(e.target.value))}
                      style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4, width: 100, background: "var(--bg)", color: "var(--text)" }} min={0} />
                  ) : k.quota_total > 0 ? (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 80, height: 8, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{
                            width: `${Math.min(100, (k.quota_used / k.quota_total) * 100)}%`, height: "100%",
                            background: k.quota_used >= k.quota_total ? "var(--danger)" : "var(--success)", borderRadius: 4,
                          }} />
                        </div>
                        <small style={{ color: "var(--text-muted)" }}>{k.quota_used}/{k.quota_total}</small>
                      </div>
                      <button onClick={() => handleResetQuota(k.id)}
                        style={{ fontSize: 11, padding: "1px 6px", cursor: "pointer", marginTop: 2, border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", color: "var(--text)" }}>
                        {t.reset}
                      </button>
                    </div>
                  ) : (
                    <span>{t.unlimited}</span>
                  )}
                </td>
                <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>
                  {new Date(k.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  {editingId === k.id ? (
                    <span style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => handleSave(k.id)} style={{ padding: "4px 8px", cursor: "pointer", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", color: "var(--text)" }}>{t.save}</button>
                      <button onClick={() => setEditingId(null)} style={{ padding: "4px 8px", cursor: "pointer", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", color: "var(--text)" }}>{t.cancel}</button>
                    </span>
                  ) : (
                    <>
                      <button onClick={() => startEdit(k)} style={{ marginRight: 8, padding: "4px 8px", cursor: "pointer", background: "none", border: "none", color: "var(--accent)", fontSize: 14 }}>{t.edit}</button>
                      <button onClick={() => handleDelete(k.id)} style={{ padding: "4px 8px", cursor: "pointer", background: "none", border: "none", color: "var(--danger)", fontSize: 14 }}>{t.delete}</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
