import { useEffect, useState, useRef } from "react";
import type { ChatMessage, Model, Protocol } from "../types";
import { listModels, streamChat } from "../api/client";
import { useI18n } from "../i18n";

export default function Playground() {
  const { t } = useI18n();
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("openai");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listModels().then((list: Model[]) => {
      const names = [...new Set(list.filter((m) => m.enabled).map((m) => m.name))];
      setModels(names);
      if (names.length > 0) setSelectedModel(names[0]);
    });
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedModel || loading) return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMsg]);

    try {
      const stream = streamChat({ model: selectedModel, messages: newMessages }, protocol);
      for await (const chunk of stream) {
        assistantMsg.content += chunk;
        setMessages([...newMessages, { ...assistantMsg }]);
      }
    } catch (err) {
      assistantMsg.content += `\n\n[Error: ${err instanceof Error ? err.message : t.unknownError}]`;
      setMessages([...newMessages, { ...assistantMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t.playground}</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={protocol} onChange={(e) => setProtocol(e.target.value as Protocol)} style={selectStyle}>
            <option value="openai">{t.openaiApi}</option>
            <option value="anthropic">{t.anthropicApi}</option>
          </select>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} style={selectStyle}>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={() => setMessages([])} style={clearBtn}>{t.clear}</button>
        </div>
      </div>

      <div style={chatContainer}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
            {t.sendMessageToStart}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            padding: "10px 14px", margin: "6px 0", borderRadius: 8,
            background: msg.role === "user" ? "var(--accent-bg)" : "var(--surface)",
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%", whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
              {msg.role === "user" ? t.you : t.assistant}
            </div>
            {(typeof msg.content === "string" ? msg.content : "") || (loading && i === messages.length - 1 ? "..." : "")}
          </div>
        ))}
        <div ref={messagesEnd} />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.chatPlaceholder}
          rows={2}
          style={textareaStyle}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()} style={sendBtn}>
          {loading ? "..." : t.send}
        </button>
      </div>
    </div>
  );
}

const chatContainer: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: 16,
  minHeight: 400, maxHeight: 500, overflowY: "auto",
  display: "flex", flexDirection: "column", background: "var(--bg)",
};
const selectStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 14,
  background: "var(--bg)", color: "var(--text)",
};
const clearBtn: React.CSSProperties = {
  padding: "6px 14px", background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 6, cursor: "pointer", fontSize: 14, color: "var(--text)",
};
const textareaStyle: React.CSSProperties = {
  flex: 1, padding: "10px", border: "1px solid var(--border)", borderRadius: 6,
  fontSize: 14, resize: "none", fontFamily: "inherit",
  background: "var(--bg)", color: "var(--text)",
};
const sendBtn: React.CSSProperties = {
  padding: "10px 24px", background: "var(--accent)", color: "var(--accent-text)",
  border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, alignSelf: "flex-end",
};
