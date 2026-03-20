import { useState, useEffect } from "react";
import { useI18n } from "../i18n";
import { getBackendOrigin } from "../api/client";

type LangTab = "curl" | "python" | "js";

export default function DocsPage() {
  const { t } = useI18n();
  const [langTab, setLangTab] = useState<LangTab>("curl");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [host, setHost] = useState("");

  useEffect(() => {
    getBackendOrigin().then((origin) => setHost(origin || window.location.origin));
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  const snippets: Record<LangTab, string> = {
    curl: `curl ${host}/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
    python: `from openai import OpenAI

client = OpenAI(
    base_url="${host}/v1",
    api_key="YOUR_API_KEY",
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`,
    js: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${host}/v1",
  apiKey: "YOUR_API_KEY",
});

const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);`,
  };

  const endpoints = [
    { method: "POST", path: "/v1/chat/completions", desc: "Chat completions (streaming supported)" },
    { method: "POST", path: "/v1/images/generations", desc: "Image generation" },
    { method: "POST", path: "/v1/embeddings", desc: "Embeddings" },
    { method: "POST", path: "/v1/messages", desc: "Anthropic Messages API" },
    { method: "GET", path: "/v1/models", desc: "List available models" },
    { method: "GET", path: "/api/version", desc: "Version info (public)" },
  ];

  const configVars = [
    { env: "HOST", yaml: "host", def: "0.0.0.0", desc: "Bind address" },
    { env: "PORT", yaml: "port", def: "8080", desc: "Listen port" },
    { env: "DB_PATH", yaml: "db_path", def: "skylark-router.db", desc: "SQLite path" },
    { env: "AUTH_TOKEN", yaml: "auth_token", def: '""', desc: "Admin token" },
    { env: "DEFAULT_MODEL", yaml: "default_model", def: '""', desc: "Default model" },
    { env: "LOG_REQUESTS", yaml: "log_requests", def: "false", desc: "Log request bodies" },
  ];

  const features = t.docsFeaturesList.split("|");

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ marginTop: 0 }}>{t.docsTitle}</h2>

      {/* Quick Start */}
      <Section title={t.docsQuickStart}>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t.docsQuickStartDesc}</p>
        <div style={{ display: "flex", gap: 0, marginBottom: 10, borderBottom: "1px solid var(--border)" }}>
          {(["curl", "python", "js"] as LangTab[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLangTab(lang)}
              style={langTab === lang ? tabActiveStyle : tabStyle}
            >
              {lang === "js" ? "JavaScript" : lang === "python" ? "Python" : "cURL"}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={() => handleCopy(snippets[langTab], "quickstart")} style={copyBtnStyle}>
            {copiedKey === "quickstart" ? t.copied : t.copy}
          </button>
        </div>
        <pre style={codeStyle}>{snippets[langTab]}</pre>
      </Section>

      {/* Endpoints */}
      <Section title={t.docsEndpoints}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Method</th>
              <th style={thStyle}>Path</th>
              <th style={thStyle}>Description</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep) => (
              <tr key={ep.path}>
                <td style={tdStyle}>
                  <span style={methodBadge(ep.method)}>{ep.method}</span>
                </td>
                <td style={tdStyle}><code style={{ fontSize: 13 }}>{ep.path}</code></td>
                <td style={tdStyle}>{ep.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Model Routing */}
      <Section title={t.docsModelRouting}>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t.docsModelRoutingDesc}</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>model</th>
              <th style={thStyle}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><code>"gpt-4o"</code></td>
              <td style={tdStyle}>{t.docsModelSpecific}</td>
            </tr>
            <tr>
              <td style={tdStyle}><code>"auto"</code></td>
              <td style={tdStyle}>{t.docsModelAuto}</td>
            </tr>
            <tr>
              <td style={tdStyle}><code style={{ color: "var(--text-muted)" }}>( empty )</code></td>
              <td style={tdStyle}>{t.docsModelDefault}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Use with Cursor */}
      <Section title={t.docsCursorTitle}>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t.docsCursorDesc}</p>
        <div style={configBlockStyle}>
          <div style={configRowStyle}>
            <span style={{ color: "var(--text-muted)", minWidth: 100 }}>Base URL</span>
            <code style={configValueStyle}>{host}/v1</code>
            <button onClick={() => handleCopy(`${host}/v1`, "baseurl")} style={copySmallStyle}>
              {copiedKey === "baseurl" ? t.copied : t.copy}
            </button>
          </div>
          <div style={configRowStyle}>
            <span style={{ color: "var(--text-muted)", minWidth: 100 }}>API Key</span>
            <code style={configValueStyle}>sk-your-key</code>
          </div>
        </div>
      </Section>

      {/* Configuration */}
      <Section title={t.docsConfiguration}>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t.docsConfigDesc}</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Env</th>
              <th style={thStyle}>YAML</th>
              <th style={thStyle}>Default</th>
              <th style={thStyle}>Description</th>
            </tr>
          </thead>
          <tbody>
            {configVars.map((v) => (
              <tr key={v.env}>
                <td style={tdStyle}><code style={{ fontSize: 12 }}>{v.env}</code></td>
                <td style={tdStyle}><code style={{ fontSize: 12 }}>{v.yaml}</code></td>
                <td style={tdStyle}><code style={{ fontSize: 12 }}>{v.def}</code></td>
                <td style={tdStyle}>{v.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Features */}
      <Section title={t.docsFeatures}>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          {features.map((f, i) => (
            <li key={i} style={{ marginBottom: 8, lineHeight: 1.6, color: "var(--text-secondary)" }}>{f}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

const methodBadge = (method: string): React.CSSProperties => ({
  padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: "monospace",
  background: method === "GET" ? "var(--success-bg)" : "var(--accent-bg)",
  color: method === "GET" ? "var(--success-text)" : "var(--accent)",
});

const tabStyle: React.CSSProperties = {
  padding: "4px 14px", background: "none", border: "none",
  borderBottom: "2px solid transparent", cursor: "pointer",
  fontSize: 13, color: "var(--text-muted)", marginBottom: -1,
};
const tabActiveStyle: React.CSSProperties = {
  ...tabStyle, color: "var(--accent)", borderBottom: "2px solid var(--accent)", fontWeight: 600,
};
const copyBtnStyle: React.CSSProperties = {
  padding: "4px 12px", background: "none", border: "1px solid var(--border)",
  borderRadius: 4, cursor: "pointer", fontSize: 12, color: "var(--text-secondary)", alignSelf: "center",
};
const codeStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6,
  padding: "12px 16px", fontSize: 13, lineHeight: 1.6,
  overflowX: "auto", whiteSpace: "pre", margin: 0, fontFamily: "monospace",
  color: "var(--text)",
};
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "8px 12px", borderBottom: "2px solid var(--border)",
  fontSize: 12, color: "var(--text-muted)",
};
const tdStyle: React.CSSProperties = {
  padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 14,
};
const configBlockStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6,
  padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8,
};
const configRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
};
const configValueStyle: React.CSSProperties = {
  fontSize: 14, fontFamily: "monospace", flex: 1,
};
const copySmallStyle: React.CSSProperties = {
  padding: "2px 8px", background: "none", border: "1px solid var(--border)",
  borderRadius: 4, cursor: "pointer", fontSize: 11, color: "var(--text-secondary)",
};
