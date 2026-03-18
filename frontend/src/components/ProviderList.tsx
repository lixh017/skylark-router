import { useEffect, useState } from "react";
import type { Provider, Model } from "../types";
import { listProviders, deleteProvider, testProvider, listModels } from "../api/client";
import ProviderForm from "./ProviderForm";
import { useI18n } from "../i18n";

interface TestState {
  open: boolean;
  loading: boolean;
  modelName: string;
  result: { ok: boolean; latency_ms: number; model_used: string; preview?: string; error?: string } | null;
}

export default function ProviderList() {
  const { t } = useI18n();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [testStates, setTestStates] = useState<Record<number, TestState>>({});

  const load = () => {
    listProviders().then(setProviders).catch(console.error);
    listModels().then(setAllModels).catch(console.error);
  };

  useEffect(load, []);

  const handleDelete = async (id: number) => {
    if (!confirm(t.deleteProviderConfirm)) return;
    await deleteProvider(id);
    load();
  };

  const getProviderModels = (providerId: number) =>
    allModels.filter((m) => m.provider_id === providerId && m.enabled);

  const patchTest = (providerId: number, patch: Partial<TestState>) =>
    setTestStates((prev) => {
      const cur: TestState = prev[providerId] ?? { open: false, loading: false, modelName: "", result: null };
      return { ...prev, [providerId]: { ...cur, ...patch } };
    });

  const toggleTest = (p: Provider) => {
    const cur = testStates[p.id];
    if (cur?.open) {
      patchTest(p.id, { open: false });
      return;
    }
    const models = getProviderModels(p.id);
    patchTest(p.id, { open: true, result: null, modelName: models[0]?.name ?? "" });
  };

  const runTest = async (p: Provider) => {
    const state = testStates[p.id];
    patchTest(p.id, { loading: true, result: null });
    try {
      const result = await testProvider(p.id, state?.modelName || undefined);
      patchTest(p.id, { loading: false, result });
    } catch (err) {
      patchTest(p.id, {
        loading: false,
        result: { ok: false, latency_ms: 0, model_used: "", error: String(err) },
      });
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>{t.providers}</h2>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={btnStyle}>
          {t.addProvider}
        </button>
      </div>

      {showForm && (
        <ProviderForm
          provider={editing}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>{t.name}</th>
            <th style={thStyle}>{t.protocol}</th>
            <th style={thStyle}>{t.baseUrl}</th>
            <th style={thStyle}>{t.apiKey}</th>
            <th style={thStyle}>{t.enabled}</th>
            <th style={thStyle}>{t.actions}</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => {
            const ts = testStates[p.id];
            const pModels = getProviderModels(p.id);
            return (
              <>
                <tr key={p.id}>
                  <td style={tdStyle}><strong style={{ fontSize: 14 }}>{p.name}</strong></td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: p.protocol === "anthropic" ? "var(--warning-bg)" : "var(--accent-bg)",
                      color: p.protocol === "anthropic" ? "var(--warning-text)" : "var(--accent)",
                    }}>
                      {p.protocol === "anthropic" ? "Anthropic" : "OpenAI"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--text-secondary)", fontSize: 13 }}>{p.base_url}</td>
                  <td style={tdStyle}>
                    <code style={{ fontSize: 12 }}>{p.api_key.slice(0, 6)}···{p.api_key.slice(-4)}</code>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13,
                      color: p.enabled ? "var(--success-text)" : "var(--danger-text)",
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                      {p.enabled ? t.yes : t.no}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button onClick={() => toggleTest(p)} style={{
                        ...linkBtn,
                        color: ts?.open ? "var(--accent)" : "var(--text-secondary)",
                        fontWeight: ts?.open ? 600 : 400,
                      }}>
                        Test
                      </button>
                      <button onClick={() => { setEditing(p); setShowForm(true); }} style={linkBtn}>
                        {t.edit}
                      </button>
                      <button onClick={() => handleDelete(p.id)} style={{ ...linkBtn, color: "var(--danger)" }}>
                        {t.delete}
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Test panel row */}
                {ts?.open && (
                  <tr key={`${p.id}-test`}>
                    <td colSpan={6} style={{ padding: "0 12px 14px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{
                        background: "var(--surface-2)", border: "1px solid var(--border)",
                        borderRadius: 10, padding: "14px 16px",
                        display: "flex", flexDirection: "column", gap: 10,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                          Test connection — {p.name}
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          {pModels.length > 0 ? (
                            <>
                              <select
                                value={ts.modelName}
                                onChange={(e) => patchTest(p.id, { modelName: e.target.value, result: null })}
                                style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13, minWidth: 180 }}
                              >
                                {pModels.map((m) => (
                                  <option key={m.id} value={m.name}>
                                    {m.name} → {m.provider_model}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => runTest(p)}
                                disabled={ts.loading}
                                style={{
                                  padding: "6px 16px", borderRadius: 7, border: "none",
                                  background: ts.loading ? "var(--surface-hover)" : "var(--accent)",
                                  color: ts.loading ? "var(--text-muted)" : "var(--accent-text)",
                                  cursor: ts.loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 500,
                                }}
                              >
                                {ts.loading ? "Testing…" : "Run Test"}
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: 13, color: "var(--warning-text)" }}>
                              ⚠ No models mapped to this provider yet. Add a model in the Models tab first.
                            </span>
                          )}
                        </div>

                        {/* Result */}
                        {ts.result && (
                          <div style={{
                            display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                            borderRadius: 8, background: ts.result.ok ? "var(--success-bg)" : "var(--danger-bg)",
                            border: `1px solid ${ts.result.ok ? "var(--success)" : "var(--danger)"}`,
                            flexWrap: "wrap",
                          }}>
                            <span style={{ fontSize: 18, lineHeight: 1 }}>{ts.result.ok ? "✓" : "✗"}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: ts.result.ok ? "var(--success-text)" : "var(--danger-text)" }}>
                                {ts.result.ok ? `Connected · ${ts.result.latency_ms} ms` : "Connection failed"}
                              </div>
                              {ts.result.model_used && (
                                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                                  {ts.result.model_used}
                                </div>
                              )}
                              {ts.result.preview && (
                                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, fontStyle: "italic" }}>
                                  "{ts.result.preview}"
                                </div>
                              )}
                              {ts.result.error && (
                                <div style={{ fontSize: 12, color: "var(--danger-text)", marginTop: 4, wordBreak: "break-word" }}>
                                  {ts.result.error}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
          {providers.length === 0 && (
            <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "var(--text-muted)", padding: "32px 12px" }}>{t.noProvidersYet}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 16px", background: "var(--accent)", color: "var(--accent-text)",
  border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
};
const linkBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--accent)",
  cursor: "pointer", fontSize: 13, padding: "2px 0",
};
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "10px 12px", borderBottom: "2px solid var(--border)",
  fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
};
const tdStyle: React.CSSProperties = {
  padding: "12px 12px", borderBottom: "1px solid var(--border)", fontSize: 14, verticalAlign: "middle",
};
