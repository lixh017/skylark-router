import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ChatRequest, ContentPart, Model } from "../types";
import { listModels, streamChat, searchWeb, getConfig } from "../api/client";
import { useI18n } from "../i18n";
import MessageContent from "./MessageContent";
import { useToast } from "./ui/Toast";

/* ── Types ── */
interface Params {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  contextLimit: number;   // 0 = unlimited
  topP: number;           // 0 = don't send
  frequencyPenalty: number;
  presencePenalty: number;
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
const defaultParams = (): Params => ({
  temperature: 0.7, maxTokens: 0, systemPrompt: "",
  contextLimit: 0, topP: 0, frequencyPenalty: 0, presencePenalty: 0,
});
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
const IconPaperclip = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);
const IconX = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconGlobe = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

/* ── Component ── */
export default function Chat() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [allModels, setAllModels] = useState<Model[]>([]);
  const modelNames = useMemo(() => [...new Set(allModels.map((m) => m.name))].sort(), [allModels]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<SavedConv[]>(readStore);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);
  const [openParamsId, setOpenParamsId] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<ContentPart[]>([]);
  const [webSearch, setWebSearch] = useState(false);
  const [searchConfigured, setSearchConfigured] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const bottomRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const activeConvIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingConvIdRef = useRef<string | null>(null);

  /* Load models */
  useEffect(() => {
    listModels().then((models) => {
      const enabled = models.filter((m) => m.enabled && m.provider?.id);
      setAllModels(enabled);
      if (columns.length === 0) setColumns([makeCol("auto")]);
    }).catch(console.error);
  }, []);

  /* Check search config */
  useEffect(() => {
    getConfig().then((cfg) => {
      setSearchConfigured(!!cfg.search_provider && !!cfg.search_api_key);
    }).catch(() => {});
  }, []);

  /* Sync refs to latest state so async handlers can read current values */
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

  const doSave = (cols: Column[]) => {
    const colData = cols.map((c) => ({
      modelName: c.modelName, protocol: c.protocol, params: c.params, messages: c.messages,
    }));
    const now = Date.now();
    // Read current IDs from refs (not from state) to avoid nested setState
    const effectiveId = activeConvIdRef.current ?? pendingConvIdRef.current;

    if (effectiveId) {
      setConversations((prev) => {
        const updated = prev.map((c) => c.id === effectiveId ? { ...c, updatedAt: now, columns: colData } : c);
        writeStore(updated);
        return updated;
      });
    } else {
      const newId = genId();
      const firstUser = cols[0]?.messages.find((m) => m.role === "user");
      const rawContent = firstUser?.content ?? "New conversation";
      const textContent = typeof rawContent === "string"
        ? rawContent
        : (rawContent.find((p) => p.type === "text") as { type: "text"; text: string } | undefined)?.text ?? "[image]";
      const name = textContent.slice(0, 42) + (textContent.length > 42 ? "…" : "");
      const nc: SavedConv = { id: newId, name, createdAt: now, updatedAt: now, columns: colData };
      pendingConvIdRef.current = newId;
      setConversations((prev) => {
        // StrictMode guard: updater may be called twice, avoid duplicate entry
        if (prev.some((c) => c.id === newId)) return prev;
        const updated = [nc, ...prev];
        writeStore(updated);
        return updated;
      });
      setActiveConvId(newId);
      setTimeout(() => { pendingConvIdRef.current = null; }, 100);
    }
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

  // Strip media (image/audio/video) from historical messages, keep only text.
  // The last message is kept intact so its attachments are still sent to the model.
  const stripOldMedia = (messages: ChatMessage[]): ChatMessage[] =>
    messages.map((msg, i) => {
      if (i === messages.length - 1 || !Array.isArray(msg.content)) return msg;
      const textParts = msg.content.filter((p) => p.type === "text");
      if (textParts.length === msg.content.length) return msg;
      const text = textParts.map((p) => (p as { type: "text"; text: string }).text).join(" ");
      return { ...msg, content: text || "[附件]" };
    });

  const streamCol = async (col: Column, userMessages: ChatMessage[], signal: AbortSignal): Promise<Column> => {
    // Apply context limit (keep system prompt + last N messages)
    const limited = col.params.contextLimit > 0
      ? userMessages.slice(-col.params.contextLimit)
      : userMessages;
    const req: ChatRequest = {
      model: col.modelName,
      messages: col.params.systemPrompt
        ? [{ role: "system", content: col.params.systemPrompt }, ...stripOldMedia(limited)]
        : stripOldMedia(limited),
      temperature: col.params.temperature,
      ...(col.params.maxTokens > 0 && { max_tokens: col.params.maxTokens }),
      ...(col.params.topP > 0 && { top_p: col.params.topP }),
      ...(col.params.frequencyPenalty !== 0 && { frequency_penalty: col.params.frequencyPenalty }),
      ...(col.params.presencePenalty !== 0 && { presence_penalty: col.params.presencePenalty }),
    };
    let content = "";
    try {
      for await (const chunk of streamChat(req, col.protocol, signal)) {
        content += chunk;
        appendChunk(col.id, chunk);
        scrollBottom(col.id);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        patchColumn(col.id, { isLoading: false });
        return { ...col, messages: [...userMessages, { role: "assistant", content }], isLoading: false };
      }
      const msg = err instanceof Error ? err.message : t.requestFailed;
      setColumns((prev) => prev.map((c) => {
        if (c.id !== col.id) return c;
        const msgs = [...c.messages];
        if (msgs.length && msgs[msgs.length - 1].role === "assistant" && !msgs[msgs.length - 1].content) {
          msgs[msgs.length - 1] = { role: "assistant", content: `⚠ ${msg}` };
        }
        return { ...c, messages: msgs, isLoading: false };
      }));
      return { ...col, messages: [...userMessages, { role: "assistant", content: `⚠ ${msg}` }], isLoading: false };
    }
    patchColumn(col.id, { isLoading: false });
    return { ...col, messages: [...userMessages, { role: "assistant", content }], isLoading: false };
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || columns.length === 0) return;

    // Capability validation
    const hasImage = attachments.some((a) => a.type === "image_url");
    const hasAudio = attachments.some((a) => a.type === "input_audio");
    const hasVideo = attachments.some((a) => a.type === "video_url");
    for (const col of columns) {
      if (col.modelName === "auto") continue; // router handles capability filtering
      const m = allModels.find((m) => m.name === col.modelName);
      if (!m) continue;
      if (hasImage && !m.input_image) { toast(`${col.modelName} 不支持图片输入`, "error"); return; }
      if (hasAudio && !m.input_audio) { toast(`${col.modelName} 不支持音频输入`, "error"); return; }
      if (hasVideo && !m.input_video) { toast(`${col.modelName} 不支持视频输入`, "error"); return; }
    }

    // Web search injection
    let searchContext = "";
    if (webSearch && text) {
      setIsSearching(true);
      try {
        const results = await searchWeb(text);
        if (results.length > 0) {
          searchContext = "以下是联网搜索结果，请参考后回答：\n\n" +
            results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n") +
            "\n\n---\n用户问题：";
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "搜索失败";
        toast(msg, "error");
        setIsSearching(false);
        return;
      }
      setIsSearching(false);
    }

    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }

    const finalText = searchContext ? searchContext + text : text;

    let userContent: string | ContentPart[];
    if (attachments.length > 0) {
      userContent = [
        ...attachments,
        ...(finalText ? [{ type: "text" as const, text: finalText }] : []),
      ];
    } else {
      userContent = finalText;
    }
    setAttachments([]);

    const userMsg: ChatMessage = { role: "user", content: userContent };
    const snap = columns;
    const abort = new AbortController();
    abortRef.current = abort;
    setColumns(snap.map((c) => ({
      ...c, messages: [...c.messages, userMsg, { role: "assistant", content: "" }], isLoading: true,
    })));
    const finalCols = await Promise.all(snap.map((col) => {
      const history = [...col.messages, userMsg];
      return streamCol({ ...col }, history, abort.signal);
    }));
    // finalCols has the definitive final state — save it directly
    const hasContent = finalCols.some((c) => c.messages.some((m) => m.role === "assistant" && m.content));
    if (hasContent) doSave(finalCols);
  };

  const addFileAsAttachment = (file: File) => {
    const LIMITS: Record<string, number> = {
      image: 100 * 1024 * 1024, audio: 25 * 1024 * 1024,
      video: 100 * 1024 * 1024, document: 20 * 1024 * 1024,
    };
    const category = file.type.startsWith("image/") ? "image"
      : file.type.startsWith("audio/") ? "audio"
      : file.type.startsWith("video/") ? "video"
      : "document"; // pdf / txt / docx / xlsx / pptx / json / html / etc.
    if (file.size > LIMITS[category]) {
      toast(`文件过大（限 ${LIMITS[category] / 1024 / 1024}MB）`, "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as string;
      if (!data) return;
      if (category === "image") {
        setAttachments((prev) => [...prev, { type: "image_url", image_url: { url: data } }]);
      } else if (category === "audio") {
        const format = file.type.split("/")[1].replace("mpeg", "mp3");
        const base64 = data.split(",")[1];
        setAttachments((prev) => [...prev, { type: "input_audio", input_audio: { data: base64, format } }]);
      } else if (category === "video") {
        setAttachments((prev) => [...prev, { type: "video_url", video_url: { url: data, mime_type: file.type } }]);
      } else {
        const base64 = data.split(",")[1];
        setAttachments((prev) => [...prev, { type: "document", document: { name: file.name, data: base64, mimeType: file.type } }]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(addFileAsAttachment);
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const mediaItems = items.filter((it) =>
      it.type.startsWith("image/") || it.type.startsWith("audio/") || it.type.startsWith("video/")
    );
    if (mediaItems.length > 0) {
      e.preventDefault();
      mediaItems.forEach((it) => {
        const file = it.getAsFile();
        if (file) addFileAsAttachment(file);
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(addFileAsAttachment);
  };

  const newChat = () => {
    setActiveConvId(null);
    setColumns([makeCol("auto")]);
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
  const canSend = (input.trim().length > 0 || attachments.length > 0) && !anyLoading && !isSearching && columns.length > 0;
  const groups = groupConvs(conversations);

  const hasImage = attachments.some((a) => a.type === "image_url");
  const hasAudio = attachments.some((a) => a.type === "input_audio");
  const hasVideo = attachments.some((a) => a.type === "video_url");
  const getColWarning = (col: Column): string | null => {
    if (col.modelName === "auto") return null;
    const m = allModels.find((m) => m.name === col.modelName);
    if (!m) return null;
    if (hasImage && !m.input_image) return "不支持图片输入";
    if (hasAudio && !m.input_audio) return "不支持音频输入";
    if (hasVideo && !m.input_video) return "不支持视频输入";
    return null;
  };

  /* ── Params panel for a column ── */
  const ParamsPanel = ({ col }: { col: Column }) => (
    <div style={{
      position: "absolute", top: "100%", left: 0, zIndex: 50, marginTop: 6,
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, padding: 14, width: 280, maxHeight: 480, overflowY: "auto",
      boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        Model Parameters
      </div>

      {/* Temperature */}
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

      {/* Top P */}
      <label style={labelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Top P <span style={{ color: "var(--text-muted)", fontSize: 11 }}>(0 = skip)</span></span>
          <span style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{col.params.topP.toFixed(2)}</span>
        </div>
        <input type="range" min={0} max={1} step={0.05} value={col.params.topP}
          onChange={(e) => patchParams(col.id, { topP: parseFloat(e.target.value) })}
          style={{ width: "100%", accentColor: "var(--accent)" }} />
      </label>

      {/* Frequency Penalty */}
      <label style={labelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Frequency Penalty</span>
          <span style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{col.params.frequencyPenalty.toFixed(1)}</span>
        </div>
        <input type="range" min={-2} max={2} step={0.1} value={col.params.frequencyPenalty}
          onChange={(e) => patchParams(col.id, { frequencyPenalty: parseFloat(e.target.value) })}
          style={{ width: "100%", accentColor: "var(--accent)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
          <span>-2.0</span><span>+2.0</span>
        </div>
      </label>

      {/* Presence Penalty */}
      <label style={labelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Presence Penalty</span>
          <span style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{col.params.presencePenalty.toFixed(1)}</span>
        </div>
        <input type="range" min={-2} max={2} step={0.1} value={col.params.presencePenalty}
          onChange={(e) => patchParams(col.id, { presencePenalty: parseFloat(e.target.value) })}
          style={{ width: "100%", accentColor: "var(--accent)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
          <span>-2.0</span><span>+2.0</span>
        </div>
      </label>

      {/* Max tokens */}
      <label style={labelStyle}>
        <div>Max tokens <span style={{ color: "var(--text-muted)", fontSize: 11 }}>(0 = model default)</span></div>
        <input type="number" min={0} max={32000} step={256} value={col.params.maxTokens}
          onChange={(e) => patchParams(col.id, { maxTokens: parseInt(e.target.value) || 0 })}
          style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13 }} />
      </label>

      {/* Context limit */}
      <label style={labelStyle}>
        <div>Context messages <span style={{ color: "var(--text-muted)", fontSize: 11 }}>(0 = unlimited)</span></div>
        <input type="number" min={0} max={200} step={2} value={col.params.contextLimit}
          onChange={(e) => patchParams(col.id, { contextLimit: parseInt(e.target.value) || 0 })}
          style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13 }} />
      </label>

      {/* System prompt */}
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

        {conversations.length > 0 && (
          <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <button
              onClick={() => {
                if (!confirm("Clear all conversations?")) return;
                writeStore([]);
                setConversations([]);
                newChat();
              }}
              style={{
                width: "100%", padding: "6px 10px", fontSize: 11,
                background: "none", border: "1px solid var(--border)", borderRadius: 6,
                color: "var(--text-muted)", cursor: "pointer",
              }}
            >
              Clear all conversations
            </button>
          </div>
        )}
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
                <option value="auto">✦ auto</option>
                {modelNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              {getColWarning(col) && (
                <span
                  title={getColWarning(col)!}
                  style={{ color: "#ed8936", fontSize: 14, flexShrink: 0, cursor: "help", lineHeight: 1 }}
                >⚠</span>
              )}
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
          {columns.length < 4 && (
            <button onClick={() => setColumns((p) => [...p, makeCol("auto")])}
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
                      {col.params.topP > 0 ? `  P=${col.params.topP.toFixed(2)}` : ""}
                      {col.params.maxTokens > 0 ? `  max=${col.params.maxTokens}` : ""}
                      {col.params.contextLimit > 0 ? `  ctx=${col.params.contextLimit}` : ""}
                      {col.params.systemPrompt ? "  [system]" : ""}
                    </div>
                  </div>
                ) : col.messages.map((msg, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 5, paddingInline: 4 }}>
                      {msg.role === "user" ? t.you : col.modelName}
                    </div>
                    {msg.role === "user" ? (
                      <div style={{
                        maxWidth: columns.length === 1 ? "70%" : "90%",
                        background: "var(--accent)",
                        color: "var(--accent-text)",
                        borderRadius: "18px 18px 4px 18px",
                        padding: "10px 14px", fontSize: 14, lineHeight: 1.65,
                        wordBreak: "break-word",
                      }}>
                        <MessageContent content={msg.content} />
                      </div>
                    ) : (
                      <div style={{ width: "100%", fontSize: 14, lineHeight: 1.65, wordBreak: "break-word", paddingInline: 4 }}>
                        {!msg.content && col.isLoading && i === col.messages.length - 1 ? (
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
                        ) : (
                          <>
                            <MessageContent
                              content={msg.content}
                              isStreaming={col.isLoading && i === col.messages.length - 1}
                            />
                            {col.isLoading && i === col.messages.length - 1 && msg.content && (
                              <span style={{ display: "inline-block", width: 2, height: "1em", background: "var(--text)", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={(el) => { bottomRefs.current[col.id] = el; }} />
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div style={{ padding: "10px 16px 14px", flexShrink: 0, borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            multiple
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          {/* Attachment thumbnails */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {attachments.map((part, i) => (
                <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                  {part.type === "image_url" ? (
                    <img src={part.image_url.url} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", display: "block" }} />
                  ) : part.type === "input_audio" ? (
                    <div style={{ width: 120, height: 60, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2, rgba(0,0,0,0.06))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                      <span style={{ fontSize: 20 }}>🎵</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{part.input_audio.format.toUpperCase()}</span>
                    </div>
                  ) : part.type === "document" ? (
                    <div style={{ width: 120, height: 60, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2, rgba(0,0,0,0.06))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: "0 6px" }}>
                      <span style={{ fontSize: 18 }}>{part.document.mimeType === "application/pdf" ? "📄" : "📝"}</span>
                      <span style={{ fontSize: 9, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "center" }}>{part.document.name}</span>
                    </div>
                  ) : (
                    <video
                      src={(part as { video_url: { url: string } }).video_url.url}
                      muted
                      style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", display: "block" }}
                    />
                  )}
                  <button
                    onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{
                      position: "absolute", top: -6, right: -6,
                      width: 18, height: 18, borderRadius: "50%",
                      background: "var(--danger, #e53e3e)", color: "#fff",
                      border: "none", cursor: "pointer", padding: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  >
                    <IconX />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex", gap: 6, alignItems: "flex-end",
              background: "var(--bg)", border: `1px solid ${anyLoading ? "var(--border)" : "var(--border-strong)"}`,
              borderRadius: 14, padding: "6px 6px 6px 8px",
              boxShadow: "var(--shadow)", transition: "border-color 0.15s",
            }}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {/* Paperclip button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={anyLoading}
              title="Attach image/audio/video"
              style={{
                flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                background: "none", border: "none", cursor: anyLoading ? "not-allowed" : "pointer",
                color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center",
                opacity: anyLoading ? 0.5 : 1,
              }}
            >
              <IconPaperclip />
            </button>

            {/* Web search toggle */}
            <button
              onClick={() => {
                if (!searchConfigured) { toast("请先在设置中配置搜索 API Key", "warning"); return; }
                setWebSearch((v) => !v);
              }}
              disabled={anyLoading || isSearching}
              title={searchConfigured ? (webSearch ? "关闭联网搜索" : "开启联网搜索") : "请先在设置中配置搜索 API Key"}
              style={{
                flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                background: webSearch ? "var(--accent-bg)" : "none",
                border: webSearch ? "1px solid var(--accent)" : "none",
                cursor: anyLoading || isSearching ? "not-allowed" : "pointer",
                color: webSearch ? "var(--accent)" : searchConfigured ? "var(--text-muted)" : "var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: anyLoading || isSearching ? 0.5 : 1,
              }}
            >
              {isSearching
                ? <span style={{ fontSize: 12, animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
                : <IconGlobe />}
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              onPaste={handlePaste}
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
            {anyLoading ? (
              <button
                onClick={() => { abortRef.current?.abort(); }}
                title="停止生成"
                style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: "var(--danger, #e53e3e)", color: "#fff",
                  border: "none", cursor: "pointer",
                  fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700,
                }}
              >
                ■
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: canSend ? "var(--accent)" : "var(--surface-hover)",
                  color: canSend ? "var(--accent-text)" : "var(--text-muted)",
                  border: "none", cursor: canSend ? "pointer" : "not-allowed",
                  fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.15s, color 0.15s", fontWeight: 700,
                }}
              >
                ↑
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, paddingLeft: 4 }}>
            {isSearching
              ? <span style={{ color: "var(--accent)" }}>🔍 正在搜索…</span>
              : <>Enter to send · Shift+Enter for newline · Paste or drag to attach{webSearch ? <span style={{ color: "var(--accent)", marginLeft: 6 }}>· 🌐 联网搜索已开启</span> : ""}</>
            }
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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
