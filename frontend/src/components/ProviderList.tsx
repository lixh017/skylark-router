import { useEffect, useState } from "react";
import type { Provider, Model } from "../types";
import { listProviders, deleteProvider, testProvider, listModels } from "../api/client";
import ProviderForm, { PRESETS } from "./ProviderForm";
import { Drawer } from "./ui/Drawer";
import { useI18n } from "../i18n";
import { useToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmModal";
import { SkeletonCard } from "./ui/Skeleton";
import { EmptyState } from "./ui/EmptyState";

interface TestState {
  open: boolean;
  loading: boolean;
  modelName: string;
  result: { ok: boolean; latency_ms: number; model_used: string; preview?: string; error?: string } | null;
}

export default function ProviderList() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [testStates, setTestStates] = useState<Record<number, TestState>>({});
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([listProviders(), listModels()])
      .then(([p, m]) => { setProviders(p); setAllModels(m); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: t.deleteProviderConfirm, message: "此操作无法撤销，provider 下的路由也会一并移除。", confirmLabel: t.delete, danger: true });
    if (!ok) return;
    try {
      await deleteProvider(id);
      toast("Provider 已删除", "success");
      load();
    } catch (e) {
      toast("删除失败：" + (e as Error).message, "error");
    }
  };

  const openAdd = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (p: Provider) => { setEditing(p); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  const getProviderModels = (providerId: number) =>
    allModels.filter((m) => m.provider_id === providerId && m.enabled);

  const patchTest = (providerId: number, patch: Partial<TestState>) =>
    setTestStates((prev) => {
      const cur: TestState = prev[providerId] ?? { open: false, loading: false, modelName: "", result: null };
      return { ...prev, [providerId]: { ...cur, ...patch } };
    });

  const toggleTest = (p: Provider) => {
    const cur = testStates[p.id];
    if (cur?.open) { patchTest(p.id, { open: false }); return; }
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
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>{t.providers}</h2>
        <button onClick={openAdd} style={btnPrimary}>{t.addProvider}</button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={gridStyle}>
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : providers.length === 0 ? (
        <EmptyState
          title="还没有添加任何 Provider"
          description="添加 OpenAI、Anthropic 或其他兼容服务商，开始路由你的 LLM 请求。"
          action={{ label: t.addProvider, onClick: openAdd }}
        />
      ) : (
        <div style={gridStyle}>
          {providers.map((p) => {
            const ts = testStates[p.id];
            const pModels = getProviderModels(p.id);
            const modelCount = allModels.filter((m) => m.provider_id === p.id).length;
            const preset = PRESETS.find((pr) => pr.name === p.name);
            const displayLabel = preset?.label ?? p.name;
            const category = preset?.category;

            return (
              <div key={p.id} style={cardStyle}>
                {/* Card header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    {/* Status dot */}
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: p.enabled ? "var(--success)" : "var(--text-muted)",
                      boxShadow: p.enabled ? "0 0 0 2px var(--success-bg)" : "none",
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {displayLabel}
                      </div>
                      {preset && displayLabel !== p.name && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{p.name}</div>
                      )}
                    </div>
                    {category && (
                      <span style={{
                        padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, flexShrink: 0,
                        background: category === "china" ? "rgba(255,100,0,0.1)" : category === "local" ? "var(--surface-2)" : "rgba(59,130,246,0.1)",
                        color: category === "china" ? "#e05c00" : category === "local" ? "var(--text-muted)" : "#3b82f6",
                      }}>
                        {category === "china" ? "国内" : category === "local" ? "本地" : "国际"}
                      </span>
                    )}
                  </div>
                  {/* Protocol badge */}
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 8,
                    background: p.protocol === "anthropic" ? "var(--warning-bg)" : "var(--accent-bg)",
                    color: p.protocol === "anthropic" ? "var(--warning-text)" : "var(--accent)",
                  }}>
                    {p.protocol === "anthropic" ? "Anthropic" : "OpenAI"}
                  </span>
                </div>

                {/* Base URL */}
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.base_url}
                </div>

                {/* Meta row */}
                <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <div style={metaItem}>
                    <span style={metaLabel}>API Key</span>
                    <code style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {p.api_key ? `${p.api_key.slice(0, 5)}···${p.api_key.slice(-3)}` : "—"}
                    </code>
                  </div>
                  <div style={metaItem}>
                    <span style={metaLabel}>Models</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{modelCount}</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <button
                    onClick={() => toggleTest(p)}
                    style={{
                      ...actionBtn,
                      background: ts?.open ? "var(--accent-bg)" : "var(--surface-2)",
                      color: ts?.open ? "var(--accent)" : "var(--text-secondary)",
                      border: ts?.open ? "1px solid var(--accent)" : "1px solid var(--border)",
                    }}
                  >
                    Test
                  </button>
                  <button onClick={() => openEdit(p)} style={actionBtn}>{t.edit}</button>
                  <button onClick={() => handleDelete(p.id)} style={{ ...actionBtn, color: "var(--danger)", borderColor: "transparent" }}>
                    {t.delete}
                  </button>
                </div>

                {/* Test panel */}
                {ts?.open && (
                  <div style={{
                    marginTop: 12, padding: "12px 14px", borderRadius: 8,
                    background: "var(--surface-2)", border: "1px solid var(--border)",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                      Test Connection
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {pModels.length > 0 ? (
                        <>
                          <select
                            value={ts.modelName}
                            onChange={(e) => patchTest(p.id, { modelName: e.target.value, result: null })}
                            style={selectStyle}
                          >
                            {pModels.map((m) => (
                              <option key={m.id} value={m.name}>{m.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => runTest(p)}
                            disabled={ts.loading}
                            style={{
                              padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 500, cursor: ts.loading ? "not-allowed" : "pointer",
                              background: ts.loading ? "var(--surface-hover)" : "var(--accent)",
                              color: ts.loading ? "var(--text-muted)" : "var(--accent-text)",
                            }}
                          >
                            {ts.loading ? "Testing…" : "Run"}
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--warning-text)" }}>先在 Models 页添加模型</span>
                      )}
                    </div>

                    {ts.result && (
                      <div style={{
                        marginTop: 10, padding: "8px 12px", borderRadius: 6, display: "flex", gap: 8, alignItems: "flex-start",
                        background: ts.result.ok ? "var(--success-bg)" : "var(--danger-bg)",
                        border: `1px solid ${ts.result.ok ? "var(--success)" : "var(--danger)"}`,
                      }}>
                        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{ts.result.ok ? "✓" : "✗"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: ts.result.ok ? "var(--success-text)" : "var(--danger-text)" }}>
                            {ts.result.ok ? `Connected · ${ts.result.latency_ms}ms` : "Failed"}
                          </div>
                          {ts.result.preview && (
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3, fontStyle: "italic" }}>
                              "{ts.result.preview}"
                            </div>
                          )}
                          {ts.result.error && (
                            <div style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3, wordBreak: "break-word" }}>
                              {ts.result.error}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editing ? t.editProvider : t.addProviderTitle}
        width={560}
      >
        <ProviderForm
          provider={editing}
          onSaved={() => {
            closeDrawer();
            load();
            toast(editing ? "Provider 已更新" : "Provider 已添加", "success");
          }}
          onCancel={closeDrawer}
        />
      </Drawer>
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "16px",
  transition: "box-shadow 0.15s",
};

const metaItem: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 2,
};

const metaLabel: React.CSSProperties = {
  fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600,
};

const actionBtn: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface-2)", color: "var(--text-secondary)",
  cursor: "pointer", fontSize: 12, fontWeight: 500,
};

const selectStyle: React.CSSProperties = {
  padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 12, flex: 1, minWidth: 0,
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 16px", background: "var(--accent)", color: "var(--accent-text)",
  border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
};
