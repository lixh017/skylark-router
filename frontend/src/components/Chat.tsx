import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatRequest } from "../types";
import { listModels, streamChat } from "../api/client";
import { useI18n } from "../i18n";

/* ── Types ── */
interface Params {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

interface Column {
  id: number;
  modelName: string;
  protocol: "openai" | "anthropic";
  params: Params;
  messages: ChatMessage[];
  isLoading: boolean;
}

interface SavedConv {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  columns: Array<{
    modelName: string;
    protocol: "openai" | "anthropic";
    params: Params;
    messages: ChatMessage[];
  }>;
}

/* ── Storage ── */
const STORE_KEY = "lingque_conversations";
const readStore = (): SavedConv[] => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; }
};
const writeStore = (c: SavedConv[]) => localStorage.setItem(STORE_KEY, JSON.stringify(c));

function groupConvs(convs: SavedConv[]) {
  const today = new Date().setHours(0, 0, 0, 0);
  const yesterday = today - 86400000;
  const week = today - 6 * 86400000;
  const groups: { label: string; items: SavedConv[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Last 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const c of convs) {
    if (c.updatedAt >= today) groups[0].items.push(c);
    else if (c.updatedAt >= yesterday) groups[1].items.push(c);
    else if (c.updatedAt >= week) groups[2].items.push(c);
    else groups[3].items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
}

let nextId = 1;
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const defaultParams = (): Params => ({ temperature: 0.7, maxTokens: 0, systemPrompt: "" });
const makeCol = (name: string): Column => ({
  id: nextId++, modelName: name, protocol: "openai",
  params: defaultParams(), messages: [], isLoading: false,
});

/* ── Icons ── */
const IconSettings = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const IconEdit = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

/* ── Component ── */
export default function Chat() {
  const { t } = useI18n();
  const [modelNames, setModelNames] = useState<string[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<SavedConv[]>(readStore);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);
  const [openParamsId, setOpenParamsId] = useState<number | null>(null);
  const bottomRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const prevLoadingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Load models */
  useEffect(() => {
    listModels().then((models) => {
      const enabled = models.filter((m) => m.enabled && m.provider?.id);
      const names = [...new Set(enabled.map((m) => m.name))].sort();
      setModelNames(names);
      if (names.length > 0 && columns.length === 0) setColumns([makeCol(names[0])]);
    }).catch(console.error);
  }, []);

  /* Auto-save when streaming finishes */
  useEffect(() => {
    const anyLoading = columns.some((c) => c.isLoading);
    if (prevLoadingRef.current && !anyLoading) {
      const hasResponse = columns.some((c) => c.messages.some((m) => m.role === "assistant" && m.content));
      if (hasResponse) doSave(columns);
    }
    prevLoadingRef.current = anyLoading;
  }, [columns]);

  const doSave = (cols: Column[]) => {
    const colData = cols.map((c) => ({
      modelName: c.modelName, protocol: c.protocol, params: c.params, messages: c.messages,
    }));
    const now = Date.now();
    setConversations((prev) => {
      let updated: SavedConv[];
      setActiveConvId((currentId) => {
        if (currentId) {
          updated = prev.map((c) => c.id === currentId ? { ...c, updatedAt: now, columns: colData } : c);
        } else {
          const firstUser = cols[0]?.messages.find((m) => m.role === "user")?.content || "New conversation";
          const name = firstUser.slice(0, 42) + (firstUser.length > 42 ? "…" : "");
          const newId = genId();
          const nc: SavedConv = { id: newId, name, createdAt: now, updatedAt: now, columns: colData };
          updated = [nc, ...prev];
          setTimeout(() => setActiveConvId(newId), 0);
        }
        writeStore(updated);
        return currentId;
      });
      return updated!;
    });
  };

  const scrollBottom = (id: number) => {
    setTimeout(() => bottomRefs.current[id]?.scrollIntoView({ behavior: "smooth" }), 30);
  };

  const patchColumn = (id: number, patch: Partial<Column>) =>
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const patchParams = (id: number, patch: Partial<Params>) =>
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, params: { ...c.params, ...patch } } : c));

  const appendChunk = (id: number, chunk: string) => {
    setColumns((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const msgs = [...c.messages];
      if (msgs.length && msgs[msgs.length - 1].role === "assistant") {
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + chunk };
      }
      return { ...c, messages: msgs };
    }));
  };

  const streamCol = async (col: Column, userMessages: ChatMessage[]) => {
    const req: ChatRequest = {
      model: col.modelName,
      messages: col.params.systemPrompt
        ? [{ role: "system", content: col.params.systemPrompt }, ...userMessages]
        : userMessages,
      temperature: col.params.temperature,
      ...(col.params.maxTokens > 0 && { max_tokens: col.params.maxTokens }),
    };
    try {
      for await (const chunk of streamChat(req, col.protocol)) {
        appendChunk(col.id, chunk);
        scrollBottom(col.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.requestFailed;
      setColumns((prev) => prev.map((c) => {
        if (c.id !== col.id) return c;
        const msgs = [...c.messages];
        if (msgs.length && msgs[msgs.length - 1].role === "assistant" && !msgs[msgs.length - 1].content) {
          msgs[msgs.length - 1] = { role: "assistant", content: `⚠ ${msg}` };
        }
        return { ...c, messages: msgs, isLoading: false };
      }));
      return;
    }
    patchColumn(col.id, { isLoading: false });
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || columns.length === 0) return;
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }

    const userMsg: ChatMessage = { role: "user", content: text };
    const snap = columns;
    setColumns(snap.map((c) => ({
      ...c, messages: [...c.messages, userMsg, { role: "assistant", content: "" }], isLoading: true,
    })));
    for (const col of snap) {
      const history = [...col.messages, userMsg];
      streamCol({ ...col }, history);
    }
  };

  const newChat = () => {
    setActiveConvId(null);
    setColumns(modelNames.length > 0 ? [makeCol(modelNames[0])] : []);
    setOpenParamsId(null);
  };

  const loadConv = (conv: SavedConv) => {
    setActiveConvId(conv.id);
    setOpenParamsId(null);
    setColumns(conv.columns.map((c) => ({
      id: nextId++, modelName: c.modelName, protocol: c.protocol,
      params: c.params ?? defaultParams(), messages: c.messages, isLoading: false,
    })));
  };

  const deleteConv = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = conversations.filter((c) => c.id !== id);
    writeStore(updated);
    setConversations(updated);
    if (activeConvId === id) newChat();
  };

  const commitRename = () => {
    if (!renamingId) return;
    const updated = conversations.map((c) =>
      c.id === renamingId ? { ...c, name: renameVal.trim() || c.name } : c
    );
    writeStore(updated);
    setConversations(updated);
    setRenamingId(null);
  };

  const anyLoading = columns.some((c) => c.isLoading);
  const groups = groupConvs(conversations);

  /* ── Params panel for a column ── */
  const ParamsPanel = ({ col }: { col: Column }) => (
    <div style={{
      position: "absolute", top: "100%", left: 0, zIndex: 50, marginTop: 6,
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, padding: 14, width: 260,
      boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        Model Parameters
      </div>
      <label style={labelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Temperature</span>
          <span style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{col.params.temperature.toFixed(1)}</span>
        </div>
        <input type="range" min={0} max={2} step={0.1} value={col.params.temperature}
          onChange={(e) => patchParams(col.id, { temperature: parseFloat(e.target.value) })}
          style={{ width: "100%", accentColor: "var(--accent)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
          <span>Precise 0.0</span><span>Creative 2.0</span>
        </div>
      </label>
      <label style={labelStyle}>
        <div>Max tokens <span style={{ color: "var(--text-muted)", fontSize: 11 }}>(0 = default)</span></div>
        <input type="number" min={0} max={32000} step={256} value={col.params.maxTokens}
          onChange={(e) => patchParams(col.id, { maxTokens: parseInt(e.target.value) || 0 })}
          style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13 }} />
      </label>
      <label style={labelStyle}>
        <div>System prompt</div>
        <textarea value={col.params.systemPrompt}
          onChange={(e) => patchParams(col.id, { systemPrompt: e.target.value })}
          rows={3} placeholder="You are a helpful assistant..."
          style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, resize: "vertical", fontFamily: "inherit" }} />
      </label>
    </div>
  );

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

      {/* ── Conversation sidebar ── */}
      <aside style={{
        width: 220, flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden",
      }}>
        <div style={{ padding: "12px 10px 8px", flexShrink: 0 }}>
          <button onClick={newChat} style={{
            width: "100%", padding: "8px 12px", display: "flex", alignItems: "center", gap: 7,
            background: "var(--accent)", color: "var(--accent-text)",
            border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
          }}>
            <IconPlus /> New Chat
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 12px" }}>
          {conversations.length === 0 && (
            <div style={{ padding: "24px 10px", textAlign: "center", color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6 }}>
              No conversations yet.<br />Send a message to get started.
            </div>
          )}
          {groups.map((group) => (
            <div key={group.label}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", padding: "12px 10px 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {group.label}
              </div>
              {group.items.map((conv) => {
                const isActive = activeConvId === conv.id;
                const isHovered = hoveredConvId === conv.id;
                return (
                  <div key={conv.id}
                    onClick={() => loadConv(conv)}
                    onMouseEnter={() => setHoveredConvId(conv.id)}
                    onMouseLeave={() => setHoveredConvId(null)}
                    style={{
                      padding: "7px 8px", borderRadius: 7, cursor: "pointer", marginBottom: 1,
                      background: isActive ? "var(--accent-bg)" : isHovered ? "var(--surface-hover)" : "transparent",
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    {renamingId === conv.id ? (
                      <input autoFocus value={renameVal}
                        onChange={(e) => setRenameVal(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ flex: 1, fontSize: 12, padding: "2px 4px", border: "1px solid var(--accent)", borderRadius: 4, background: "var(--bg)", outline: "none" }}
                      />
                    ) : (
                      <>
                        <span style={{
                          flex: 1, fontSize: 12, lineHeight: 1.4,
                          color: isActive ? "var(--accent)" : "var(--text-secondary)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {conv.name}
                        </span>
                        {(isActive || isHovered) && (
                          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); setRenamingId(conv.id); setRenameVal(conv.name); }}
                              style={microBtn} title="Rename"><IconEdit /></button>
                            <button onClick={(e) => deleteConv(conv.id, e)}
                              style={{ ...microBtn, color: "var(--danger)" }} title="Delete"><IconTrash /></button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Chat main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Column selector bar */}
        <div style={{
          display: "flex", gap: 8, padding: "8px 14px",
          borderBottom: "1px solid var(--border)", flexShrink: 0,
          background: "var(--surface)", alignItems: "center",
        }}>
          {columns.map((col) => (
            <div key={col.id} style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, minWidth: 0, position: "relative" }}>
              <select value={col.modelName}
                onChange={(e) => patchColumn(col.id, { modelName: e.target.value })}
                disabled={col.isLoading} style={selectStyle}>
                {modelNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={col.protocol}
                onChange={(e) => patchColumn(col.id, { protocol: e.target.value as "openai" | "anthropic" })}
                disabled={col.isLoading} style={{ ...selectStyle, flex: "0 0 90px" }}>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
              {/* Params toggle */}
              <button
                onClick={() => setOpenParamsId(openParamsId === col.id ? null : col.id)}
                style={{
                  ...iconBtn,
                  background: openParamsId === col.id ? "var(--accent-bg)" : "none",
                  color: openParamsId === col.id ? "var(--accent)" : "var(--text-muted)",
                }}
                title="Parameters"
              >
                <IconSettings />
              </button>
              {columns.length > 1 && (
                <button onClick={() => setColumns((p) => p.filter((c) => c.id !== col.id))}
                  style={{ ...iconBtn, color: "var(--danger)" }} title={t.removeColumn}>✕</button>
              )}
              {openParamsId === col.id && <ParamsPanel col={col} />}
            </div>
          ))}
          {columns.length < 4 && modelNames.length > 0 && (
            <button onClick={() => setColumns((p) => [...p, makeCol(modelNames[0])])}
              style={{ padding: "5px 10px", fontSize: 12, border: "1px dashed var(--border)", borderRadius: 7, background: "transparent", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
              + Compare
            </button>
          )}
        </div>

        {/* Click outside to close params */}
        {openParamsId !== null && (
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpenParamsId(null)} />
        )}

        {/* Messages */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          {columns.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{ fontSize: 36, opacity: 0.3 }}>✦</div>
              <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{t.clickAddModel}</div>
            </div>
          ) : (
            columns.map((col, idx) => (
              <div key={col.id} style={{
                flex: 1, overflowY: "auto", padding: "20px 20px 8px",
                borderLeft: idx > 0 ? "1px solid var(--border)" : "none",
                display: "flex", flexDirection: "column", gap: 16, minWidth: 0,
              }}>
                {col.messages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)" }}>
                    <div style={{ fontSize: 28, opacity: 0.25 }}>✦</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{col.modelName}</div>
                    <div style={{ fontSize: 12 }}>
                      T={col.params.temperature.toFixed(1)}
                      {col.params.maxTokens > 0 ? `  max=${col.params.maxTokens}` : ""}
                      {col.params.systemPrompt ? "  [system]" : ""}
                    </div>
                  </div>
                ) : col.messages.map((msg, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 5, paddingInline: 4 }}>
                      {msg.role === "user" ? t.you : col.modelName}
                    </div>
                    <div style={{
                      maxWidth: columns.length === 1 ? "70%" : "100%",
                      background: msg.role === "user" ? "var(--accent)" : "var(--surface-2)",
                      color: msg.role === "user" ? "var(--accent-text)" : "var(--text)",
                      borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      padding: "10px 14px", fontSize: 14, lineHeight: 1.65,
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                      border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                    }}>
                      {msg.content || (
                        col.isLoading && i === col.messages.length - 1 ?
                          <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                            {[0, 1, 2].map((n) => (
                              <span key={n} style={{
                                width: 5, height: 5, borderRadius: "50%",
                                background: "var(--text-muted)",
                                animation: `bounce 1.2s ${n * 0.2}s infinite`,
                                display: "inline-block",
                              }} />
                            ))}
                          </span>
                          : null
                      )}
                    </div>
                  </div>
                ))}
                <div ref={(el) => { bottomRefs.current[col.id] = el; }} />
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div style={{ padding: "10px 16px 14px", flexShrink: 0, borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
          <div style={{
            display: "flex", gap: 10, alignItems: "flex-end",
            background: "var(--bg)", border: `1px solid ${anyLoading ? "var(--border)" : "var(--border-strong)"}`,
            borderRadius: 14, padding: "6px 6px 6px 16px",
            boxShadow: "var(--shadow)", transition: "border-color 0.15s",
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={t.chatPlaceholder}
              rows={1}
              disabled={anyLoading}
              style={{
                flex: 1, border: "none", outline: "none", resize: "none",
                fontSize: 14, background: "transparent", color: "var(--text)",
                padding: "6px 0", fontFamily: "inherit", lineHeight: 1.55,
                maxHeight: 140, overflowY: "auto",
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
              }}
            />
            <button
              onClick={handleSend}
              disabled={anyLoading || !input.trim() || columns.length === 0}
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: anyLoading || !input.trim() || columns.length === 0 ? "var(--surface-hover)" : "var(--accent)",
                color: anyLoading || !input.trim() || columns.length === 0 ? "var(--text-muted)" : "var(--accent-text)",
                border: "none", cursor: anyLoading || !input.trim() ? "not-allowed" : "pointer",
                fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s, color 0.15s", fontWeight: 700,
              }}
            >
              {anyLoading ? "…" : "↑"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, paddingLeft: 4 }}>
            Enter to send · Shift+Enter for newline
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ── Micro-styles ── */
const selectStyle: React.CSSProperties = {
  flex: 1, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 7,
  fontSize: 12, minWidth: 0, background: "var(--bg)", color: "var(--text)", cursor: "pointer",
};
const iconBtn: React.CSSProperties = {
  flexShrink: 0, padding: "5px 7px", border: "1px solid var(--border)", borderRadius: 7,
  cursor: "pointer", fontSize: 13, background: "none", color: "var(--text-muted)",
  display: "flex", alignItems: "center",
};
const microBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: "3px 4px",
  color: "var(--text-muted)", borderRadius: 4, display: "flex", alignItems: "center",
};
const labelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--text-secondary",
};
