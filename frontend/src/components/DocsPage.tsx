import { useState, useEffect } from "react";
import { useI18n } from "../i18n";
import { getBackendOrigin } from "../api/client";

type LangTab = "curl" | "python" | "js";
type IntegTool = "cursor" | "claudecode" | "codex" | "trae" | "openclaw" | "cline" | "continue" | "lobechat" | "openwebui";

const INTEG_TOOLS: { id: IntegTool; label: string }[] = [
  { id: "cursor",     label: "Cursor" },
  { id: "claudecode", label: "Claude Code" },
  { id: "codex",      label: "Codex CLI" },
  { id: "trae",       label: "Trae" },
  { id: "openclaw",   label: "OpenClaw" },
  { id: "cline",      label: "Cline" },
  { id: "continue",   label: "Continue" },
  { id: "lobechat",   label: "LobeChat" },
  { id: "openwebui",  label: "Open WebUI" },
];

export default function DocsPage() {
  const { t } = useI18n();
  const [langTab, setLangTab] = useState<LangTab>("curl");
  const [integTool, setIntegTool] = useState<IntegTool>("cursor");
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
    { method: "GET",  path: "/v1/models",   desc: "List available models" },
    { method: "GET",  path: "/api/version", desc: "Version info (public)" },
  ];

  const configVars = [
    { env: "HOST",          yaml: "host",          def: "0.0.0.0",           desc: "Bind address" },
    { env: "PORT",          yaml: "port",          def: "16898",             desc: "Listen port" },
    { env: "DB_PATH",       yaml: "db_path",       def: "skylark-router.db", desc: "SQLite path" },
    { env: "AUTH_TOKEN",    yaml: "auth_token",    def: '""',                desc: "Admin token" },
    { env: "DEFAULT_MODEL", yaml: "default_model", def: '""',                desc: "Default model" },
    { env: "LOG_REQUESTS",  yaml: "log_requests",  def: "false",             desc: "Log request bodies" },
  ];

  const features = t.docsFeaturesList.split("|");

  const integContent: Record<IntegTool, React.ReactNode> = {
    cursor: (
      <>
        <p style={descStyle}>Settings → Models → Add Model → set Base URL and API Key.</p>
        <ConfigBlock host={host} copiedKey={copiedKey} onCopy={handleCopy} />
        <Steps items={[
          "Open Cursor Settings (⌘, / Ctrl+,) → Models",
          "Scroll to the bottom → Add Model → enter your model name (must match your Router's Models tab)",
          "Toggle Override OpenAI Base URL → paste the Base URL above",
          "Set API Key → click Verify",
        ]} />
      </>
    ),
    claudecode: (
      <>
        <p style={descStyle}>Claude Code reads <code style={inlineCode}>ANTHROPIC_BASE_URL</code> and <code style={inlineCode}>ANTHROPIC_API_KEY</code> from the environment.</p>
        <p style={{ ...descStyle, marginTop: 8, marginBottom: 4, fontWeight: 600 }}>Option A — environment variables</p>
        <pre style={codeStyle}>{`export ANTHROPIC_BASE_URL=${host}
export ANTHROPIC_API_KEY=sk-your-router-key
claude`}</pre>
        <p style={{ ...descStyle, marginTop: 12, marginBottom: 4, fontWeight: 600 }}>Option B — persistent config</p>
        <pre style={codeStyle}>{`claude config set --global apiUrl ${host}`}</pre>
        <p style={{ ...descStyle, marginTop: 8 }}>
          Make sure your Router has a model named <code style={inlineCode}>claude-sonnet-4-5</code> (or whichever model Claude Code requests) mapped to an Anthropic provider.
        </p>
      </>
    ),
    codex: (
      <>
        <p style={descStyle}>OpenAI Codex CLI uses <code style={inlineCode}>OPENAI_BASE_URL</code> and <code style={inlineCode}>OPENAI_API_KEY</code>.</p>
        <pre style={codeStyle}>{`export OPENAI_API_KEY=sk-your-router-key
export OPENAI_BASE_URL=${host}/v1
codex`}</pre>
        <p style={{ ...descStyle, marginTop: 8 }}>Or inline:</p>
        <pre style={codeStyle}>{`OPENAI_API_KEY=sk-key OPENAI_BASE_URL=${host}/v1 codex "refactor this function"`}</pre>
      </>
    ),
    trae: (
      <>
        <p style={descStyle}>Trae IDE (by ByteDance) supports custom OpenAI-compatible providers.</p>
        <ConfigBlock host={host} copiedKey={copiedKey} onCopy={handleCopy} copyKey="trae" />
        <Steps items={[
          "Open Settings (⌘,) → AI → AI Service",
          "Select Custom (OpenAI-compatible)",
          "Paste the Base URL and API Key above",
          "Enter the model name (must match your Router's Models tab) → Test Connection",
        ]} />
      </>
    ),
    openclaw: (
      <>
        <p style={descStyle}>Add a custom provider in <code style={inlineCode}>~/.openclaw/openclaw.json</code>:</p>
        <pre style={codeStyle}>{`{
  models: {
    providers: {
      skylark: {
        baseUrl: "${host}/v1",
        apiKey: "sk-your-router-key",
      },
    },
  },
  agents: {
    defaults: {
      // Format: "provider/model-name" — model-name must match Router's Models tab
      model: { primary: "skylark/gpt-4o" },
      models: {
        "skylark/gpt-4o": { alias: "GPT-4o via Skylark" },
      },
    },
  },
}`}</pre>
        <p style={{ ...descStyle, marginTop: 8 }}>
          Skylark Router handles failover internally, so a single model entry is usually enough.
          Use OpenClaw's <code style={inlineCode}>fallbacks</code> only for application-level fallback across different model names.
        </p>
      </>
    ),
    cline: (
      <>
        <p style={descStyle}>Cline is a VS Code extension for AI-powered coding.</p>
        <ConfigBlock host={host} copiedKey={copiedKey} onCopy={handleCopy} copyKey="cline" />
        <Steps items={[
          "Open the Cline panel in VS Code sidebar → click the settings icon",
          "API Provider → select OpenAI Compatible",
          "Paste the Base URL and API Key above",
          "Enter Model ID (must match your Router's Models tab)",
        ]} />
      </>
    ),
    continue: (
      <>
        <p style={descStyle}>Edit <code style={inlineCode}>~/.continue/config.json</code>:</p>
        <pre style={codeStyle}>{`{
  "models": [
    {
      "title": "Skylark Router",
      "provider": "openai",
      "model": "gpt-4o",
      "apiBase": "${host}/v1",
      "apiKey": "sk-your-router-key"
    }
  ]
}`}</pre>
        <p style={{ ...descStyle, marginTop: 8 }}>For Anthropic protocol, use <code style={inlineCode}>"provider": "anthropic"</code> and set <code style={inlineCode}>"apiBase": "${host}"</code> (without <code style={inlineCode}>/v1</code>).</p>
      </>
    ),
    lobechat: (
      <>
        <p style={descStyle}>Settings → Language Model → OpenAI → set endpoint and key.</p>
        <ConfigBlock host={host} copiedKey={copiedKey} onCopy={handleCopy} copyKey="lobe" />
        <Steps items={[
          "Settings → Language Model → OpenAI",
          `Set API Endpoint to: ${host}/v1`,
          "Set API Key to your router key",
          "Under Model List, click + to add your model names",
        ]} />
        <p style={{ ...descStyle, marginTop: 8 }}>For self-hosted LobeChat, set environment variables:</p>
        <pre style={codeStyle}>{`OPENAI_API_KEY=sk-your-router-key
OPENAI_PROXY_URL=${host}/v1`}</pre>
      </>
    ),
    openwebui: (
      <>
        <p style={descStyle}>Admin Panel → Settings → Connections → OpenAI API.</p>
        <ConfigBlock host={host} copiedKey={copiedKey} onCopy={handleCopy} copyKey="owui" />
        <Steps items={[
          "Go to Admin Panel → Settings → Connections",
          `Under OpenAI API, set URL to: ${host}/v1`,
          "Set Key to your router key → Save",
          "The router's model list will auto-populate in the model picker",
        ]} />
      </>
    ),
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ marginTop: 0 }}>{t.docsTitle}</h2>

      {/* Quick Start */}
      <Section title={t.docsQuickStart}>
        <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>{t.docsQuickStartDesc}</p>
        <div style={{ display: "flex", gap: 0, marginBottom: 10, borderBottom: "1px solid var(--border)" }}>
          {(["curl", "python", "js"] as LangTab[]).map((lang) => (
            <button key={lang} onClick={() => setLangTab(lang)} style={langTab === lang ? tabActiveStyle : tabStyle}>
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

      {/* Client Integrations */}
      <Section title={t.docsIntegrationsTitle}>
        <p style={{ color: "var(--text-secondary)", marginTop: 0, marginBottom: 12 }}>{t.docsIntegrationsDesc}</p>
        {/* Tool tab strip */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {INTEG_TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setIntegTool(tool.id)}
              style={integTool === tool.id ? integTabActiveStyle : integTabStyle}
            >
              {tool.label}
            </button>
          ))}
        </div>
        {/* Tool content */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 20px" }}>
          {integContent[integTool]}
        </div>
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
                <td style={tdStyle}><span style={methodBadge(ep.method)}>{ep.method}</span></td>
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

/* ── Sub-components ── */

function ConfigBlock({ host, copiedKey, onCopy, copyKey = "baseurl" }: {
  host: string; copiedKey: string | null;
  onCopy: (text: string, key: string) => void; copyKey?: string;
}) {
  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 14px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "var(--text-muted)", minWidth: 80, fontSize: 13 }}>Base URL</span>
        <code style={{ fontSize: 13, fontFamily: "monospace", flex: 1 }}>{host}/v1</code>
        <button onClick={() => onCopy(`${host}/v1`, copyKey)} style={copySmallStyle}>
          {copiedKey === copyKey ? "Copied" : "Copy"}
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "var(--text-muted)", minWidth: 80, fontSize: 13 }}>API Key</span>
        <code style={{ fontSize: 13, fontFamily: "monospace", flex: 1, color: "var(--text-muted)" }}>sk-your-router-key</code>
      </div>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol style={{ paddingLeft: 20, margin: 0, color: "var(--text-secondary)", lineHeight: 1.7 }}>
      {items.map((item, i) => <li key={i} style={{ marginBottom: 4 }}>{item}</li>)}
    </ol>
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

/* ── Styles ── */

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
const integTabStyle: React.CSSProperties = {
  padding: "5px 14px", background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 20, cursor: "pointer", fontSize: 12, color: "var(--text-secondary)",
};
const integTabActiveStyle: React.CSSProperties = {
  ...integTabStyle,
  background: "var(--accent-bg)", borderColor: "var(--accent)",
  color: "var(--accent)", fontWeight: 600,
};
const copyBtnStyle: React.CSSProperties = {
  padding: "4px 12px", background: "none", border: "1px solid var(--border)",
  borderRadius: 4, cursor: "pointer", fontSize: 12, color: "var(--text-secondary)", alignSelf: "center",
};
const codeStyle: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6,
  padding: "12px 16px", fontSize: 13, lineHeight: 1.6,
  overflowX: "auto", whiteSpace: "pre", margin: "8px 0 0", fontFamily: "monospace",
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
const descStyle: React.CSSProperties = { color: "var(--text-secondary)", margin: "0 0 10px", fontSize: 14 };
const inlineCode: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, background: "var(--bg)", padding: "1px 5px", borderRadius: 3 };
const copySmallStyle: React.CSSProperties = {
  padding: "2px 8px", background: "none", border: "1px solid var(--border)",
  borderRadius: 4, cursor: "pointer", fontSize: 11, color: "var(--text-secondary)",
};
