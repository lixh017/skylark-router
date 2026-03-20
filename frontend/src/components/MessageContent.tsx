import { useState } from "react";
import type { ContentPart } from "../types";

/* ── Think block parsing ── */
type ParsedPart =
  | { type: "text"; content: string }
  | { type: "think"; content: string }
  | { type: "thinking"; content: string }; // streaming, not yet closed

function parseThinkBlocks(text: string): ParsedPart[] {
  const parts: ParsedPart[] = [];
  const openIdx = text.indexOf("<think>");
  if (openIdx === -1) {
    if (text) parts.push({ type: "text", content: text });
    return parts;
  }
  const before = text.slice(0, openIdx);
  if (before) parts.push({ type: "text", content: before });

  const closeIdx = text.indexOf("</think>", openIdx + 7);
  if (closeIdx === -1) {
    // Still streaming
    const thinkContent = text.slice(openIdx + 7);
    parts.push({ type: "thinking", content: thinkContent });
  } else {
    const thinkContent = text.slice(openIdx + 7, closeIdx);
    parts.push({ type: "think", content: thinkContent });
    const after = text.slice(closeIdx + 8);
    if (after) parts.push(...parseThinkBlocks(after));
  }
  return parts;
}

/* ── Inline markdown renderer ── */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let keyIdx = 0;
  const mk = () => `${keyPrefix}-il-${keyIdx++}`;

  while (i < text.length) {
    // Inline code `...`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        nodes.push(
          <code key={mk()} style={inlineCodeStyle}>
            {text.slice(i + 1, end)}
          </code>
        );
        i = end + 1;
        continue;
      }
    }

    // Bold **...**
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        const k = mk();
        nodes.push(<strong key={k}>{renderInline(text.slice(i + 2, end), k)}</strong>);
        i = end + 2;
        continue;
      }
    }

    // Italic *...*
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && text[end + 1] !== "*") {
        const k = mk();
        nodes.push(<em key={k}>{renderInline(text.slice(i + 1, end), k)}</em>);
        i = end + 1;
        continue;
      }
    }

    // Bold _..._
    if (text[i] === "_" && text[i + 1] === "_") {
      const end = text.indexOf("__", i + 2);
      if (end !== -1) {
        const k = mk();
        nodes.push(<strong key={k}>{renderInline(text.slice(i + 2, end), k)}</strong>);
        i = end + 2;
        continue;
      }
    }

    // Link [text](url)
    if (text[i] === "[") {
      const closeB = text.indexOf("]", i + 1);
      if (closeB !== -1 && text[closeB + 1] === "(") {
        const closeP = text.indexOf(")", closeB + 2);
        if (closeP !== -1) {
          const linkText = text.slice(i + 1, closeB);
          const url = text.slice(closeB + 2, closeP);
          nodes.push(
            <a key={mk()} href={url} target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "underline" }}>
              {linkText}
            </a>
          );
          i = closeP + 1;
          continue;
        }
      }
    }

    // Accumulate plain text until next special char
    let j = i + 1;
    while (j < text.length) {
      const c = text[j];
      if (c === "`" || c === "*" || c === "_" || c === "[") break;
      j++;
    }
    nodes.push(text.slice(i, j));
    i = j;
  }

  return nodes;
}

/* ── Block markdown renderer ── */
function renderMarkdown(text: string): React.ReactNode {
  if (!text.trim()) return null;
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let keyIdx = 0;
  const mk = () => `md-${keyIdx++}`;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const k = mk();
      blocks.push(
        <div key={k} style={codeBlockWrapStyle}>
          {lang && <div style={codeLangStyle}>{lang}</div>}
          <pre style={codeBlockStyle}>
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Headings
    const h3m = line.match(/^### (.+)/);
    const h2m = line.match(/^## (.+)/);
    const h1m = line.match(/^# (.+)/);
    if (h1m) {
      const k = mk();
      blocks.push(<h1 key={k} style={{ fontSize: "1.3em", fontWeight: 700, margin: "12px 0 6px", lineHeight: 1.3 }}>{renderInline(h1m[1], k)}</h1>);
      i++; continue;
    }
    if (h2m) {
      const k = mk();
      blocks.push(<h2 key={k} style={{ fontSize: "1.15em", fontWeight: 700, margin: "10px 0 5px", lineHeight: 1.3 }}>{renderInline(h2m[1], k)}</h2>);
      i++; continue;
    }
    if (h3m) {
      const k = mk();
      blocks.push(<h3 key={k} style={{ fontSize: "1.05em", fontWeight: 600, margin: "8px 0 4px", lineHeight: 1.3 }}>{renderInline(h3m[1], k)}</h3>);
      i++; continue;
    }

    // Unordered list
    if (line.match(/^[-*•] /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*•] /)) {
        const k = mk();
        items.push(<li key={k} style={{ marginBottom: 2 }}>{renderInline(lines[i].replace(/^[-*•] /, ""), k)}</li>);
        i++;
      }
      blocks.push(<ul key={mk()} style={{ margin: "6px 0", paddingLeft: 20 }}>{items}</ul>);
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        const k = mk();
        items.push(<li key={k} style={{ marginBottom: 2 }}>{renderInline(lines[i].replace(/^\d+\. /, ""), k)}</li>);
        i++;
      }
      blocks.push(<ol key={mk()} style={{ margin: "6px 0", paddingLeft: 20 }}>{items}</ol>);
      continue;
    }

    // Empty line - paragraph break
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-special lines
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (
        l.startsWith("```") ||
        l.match(/^#{1,3} /) ||
        l.match(/^[-*•] /) ||
        l.match(/^\d+\. /) ||
        l.trim() === ""
      ) break;
      paraLines.push(l);
      i++;
    }
    if (paraLines.length > 0) {
      const k = mk();
      blocks.push(
        <p key={k} style={{ margin: "0 0 8px", lineHeight: 1.65 }}>
          {paraLines.flatMap((l, li) => {
            const k2 = `${k}-p${li}`;
            return li > 0 ? [<br key={`${k2}-br`} />, ...renderInline(l, k2)] : renderInline(l, k2);
          })}
        </p>
      );
    }
  }

  return blocks.length > 0 ? <>{blocks}</> : null;
}

/* ── Think block component ── */
function ThinkBlock({ content, streaming }: { content: string; streaming: boolean }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div style={thinkWrapStyle}>
      <button
        onClick={() => setCollapsed((v) => !v)}
        style={thinkHeaderStyle}
      >
        <span style={{ fontSize: 12, marginRight: 4, transition: "transform 0.2s", display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
        {streaming ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontStyle: "italic" }}>Thinking</span>
            {[0, 1, 2].map((n) => (
              <span key={n} style={{
                width: 3, height: 3, borderRadius: "50%",
                background: "var(--text-muted)",
                animation: `bounce 1.2s ${n * 0.2}s infinite`,
                display: "inline-block",
              }} />
            ))}
          </span>
        ) : (
          <span>{collapsed ? "Show thinking" : "Hide thinking"}</span>
        )}
      </button>
      {!collapsed && (
        <div style={thinkBodyStyle}>
          {renderMarkdown(content)}
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */
export default function MessageContent({
  content,
  isStreaming = false,
}: {
  content: string | ContentPart[];
  isStreaming?: boolean;
}) {
  if (Array.isArray(content)) {
    return (
      <div>
        {content.map((part, i) => {
          if (part.type === "image_url") {
            return (
              <img
                key={i}
                src={part.image_url.url}
                style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8, display: "block", marginBottom: 8, objectFit: "contain" }}
                alt="Attached image"
              />
            );
          }
          if (part.type === "input_audio") {
            return (
              <audio
                key={i}
                controls
                src={`data:audio/${part.input_audio.format};base64,${part.input_audio.data}`}
                style={{ maxWidth: "100%", marginBottom: 8, display: "block" }}
              />
            );
          }
          if (part.type === "video_url") {
            return (
              <video
                key={i}
                controls
                src={part.video_url.url}
                style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8, marginBottom: 8, display: "block" }}
              />
            );
          }
          return <div key={i}>{renderMarkdown(part.text)}</div>;
        })}
      </div>
    );
  }

  const parts = parseThinkBlocks(content);
  return (
    <div>
      {parts.map((part, i) => {
        if (part.type === "think") {
          return <ThinkBlock key={i} content={part.content} streaming={false} />;
        }
        if (part.type === "thinking") {
          return <ThinkBlock key={i} content={part.content} streaming={isStreaming} />;
        }
        return <div key={i}>{renderMarkdown(part.content)}</div>;
      })}
    </div>
  );
}

/* ── Styles ── */
const inlineCodeStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, 'Fira Code', 'Cascadia Code', monospace)",
  fontSize: "0.88em",
  background: "var(--surface-2, rgba(0,0,0,0.08))",
  borderRadius: 4,
  padding: "1px 5px",
  border: "1px solid var(--border)",
};

const codeBlockWrapStyle: React.CSSProperties = {
  borderRadius: 8,
  overflow: "hidden",
  border: "1px solid var(--border)",
  margin: "10px 0",
  background: "var(--bg-code, #1e1e2e)",
};

const codeLangStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: "monospace",
  color: "var(--text-muted)",
  padding: "4px 12px",
  borderBottom: "1px solid var(--border)",
  background: "var(--surface-2)",
  userSelect: "none",
};

const codeBlockStyle: React.CSSProperties = {
  margin: 0,
  padding: "12px 16px",
  overflowX: "auto",
  fontSize: 13,
  lineHeight: 1.6,
  fontFamily: "var(--font-mono, 'Fira Code', 'Cascadia Code', monospace)",
  color: "var(--text)",
};

const thinkWrapStyle: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2, rgba(0,0,0,0.04))",
  margin: "6px 0 10px",
  overflow: "hidden",
};

const thinkHeaderStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "7px 12px",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  color: "var(--text-muted)",
  display: "flex",
  alignItems: "center",
  gap: 4,
  userSelect: "none",
};

const thinkBodyStyle: React.CSSProperties = {
  padding: "8px 16px 12px",
  borderTop: "1px solid var(--border)",
  fontSize: 13,
  color: "var(--text-secondary)",
  lineHeight: 1.65,
};
