import { useEffect, useState, useMemo } from "react";
import type { Model, Provider } from "../types";
import { listModels, deleteModel, listProviders } from "../api/client";
import ModelForm from "./ModelForm";
import { useToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmModal";
import { useI18n } from "../i18n";

interface ModelGroup {
  name: string;
  routes: Model[];
}

interface GroupCaps {
  vision: boolean;
  outputImage: boolean;
  functionCall: boolean;
  audio: boolean;
}

type LangTab = "curl" | "python" | "js";
type CapTab = "text" | "vision" | "imageGen" | "functionCall" | "audio";

function groupCaps(routes: Model[]): GroupCaps {
  return routes.reduce<GroupCaps>(
    (acc, m) => ({
      vision: acc.vision || !!m.input_image,
      outputImage: acc.outputImage || !!m.output_image,
      functionCall: acc.functionCall || !!m.function_call,
      audio: acc.audio || !!m.input_audio,
    }),
    { vision: false, outputImage: false, functionCall: false, audio: false }
  );
}

function buildSnippets(modelName: string, cap: CapTab): Record<LangTab, string> {
  const host = window.location.origin;

  if (cap === "vision") {
    return {
      curl: `curl ${host}/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "What is in this image?"},
        {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
      ]
    }]
  }'`,
      python: `from openai import OpenAI

client = OpenAI(
    base_url="${host}/v1",
    api_key="sk-your-key",
)

response = client.chat.completions.create(
    model="${modelName}",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What is in this image?"},
            {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}},
        ],
    }],
)
print(response.choices[0].message.content)`,
      js: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${host}/v1",
  apiKey: "sk-your-key",
  dangerouslyAllowBrowser: true,
});

const response = await client.chat.completions.create({
  model: "${modelName}",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "What is in this image?" },
      { type: "image_url", image_url: { url: "https://example.com/image.jpg" } },
    ],
  }],
});
console.log(response.choices[0].message.content);`,
    };
  }

  if (cap === "imageGen") {
    return {
      curl: `curl ${host}/v1/images/generations \\
  -H "Authorization: Bearer sk-your-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "prompt": "A cute cat sitting on a table",
    "n": 1,
    "size": "1024x1024"
  }'`,
      python: `from openai import OpenAI

client = OpenAI(
    base_url="${host}/v1",
    api_key="sk-your-key",
)

response = client.images.generate(
    model="${modelName}",
    prompt="A cute cat sitting on a table",
    n=1,
    size="1024x1024",
)
print(response.data[0].url)`,
      js: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${host}/v1",
  apiKey: "sk-your-key",
  dangerouslyAllowBrowser: true,
});

const response = await client.images.generate({
  model: "${modelName}",
  prompt: "A cute cat sitting on a table",
  n: 1,
  size: "1024x1024",
});
console.log(response.data[0].url);`,
    };
  }

  if (cap === "functionCall") {
    return {
      curl: `curl ${host}/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{"role": "user", "content": "What is the weather in Beijing?"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather for a city",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {"type": "string", "description": "City name"}
          },
          "required": ["city"]
        }
      }
    }],
    "tool_choice": "auto"
  }'`,
      python: `from openai import OpenAI

client = OpenAI(
    base_url="${host}/v1",
    api_key="sk-your-key",
)

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get current weather for a city",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name"}
            },
            "required": ["city"],
        },
    },
}]

response = client.chat.completions.create(
    model="${modelName}",
    messages=[{"role": "user", "content": "What is the weather in Beijing?"}],
    tools=tools,
    tool_choice="auto",
)
print(response.choices[0].message.tool_calls)`,
      js: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${host}/v1",
  apiKey: "sk-your-key",
  dangerouslyAllowBrowser: true,
});

const tools = [{
  type: "function",
  function: {
    name: "get_weather",
    description: "Get current weather for a city",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
  },
}];

const response = await client.chat.completions.create({
  model: "${modelName}",
  messages: [{ role: "user", content: "What is the weather in Beijing?" }],
  tools,
  tool_choice: "auto",
});
console.log(response.choices[0].message.tool_calls);`,
    };
  }

  if (cap === "audio") {
    return {
      curl: `curl ${host}/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "Transcribe and summarize this audio."},
        {"type": "input_audio", "input_audio": {
          "data": "<base64-encoded-audio>",
          "format": "mp3"
        }}
      ]
    }]
  }'`,
      python: `import base64
from openai import OpenAI

client = OpenAI(
    base_url="${host}/v1",
    api_key="sk-your-key",
)

with open("audio.mp3", "rb") as f:
    audio_data = base64.b64encode(f.read()).decode("utf-8")

response = client.chat.completions.create(
    model="${modelName}",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Transcribe and summarize this audio."},
            {"type": "input_audio", "input_audio": {"data": audio_data, "format": "mp3"}},
        ],
    }],
)
print(response.choices[0].message.content)`,
      js: `import fs from "fs";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${host}/v1",
  apiKey: "sk-your-key",
});

const audioData = fs.readFileSync("audio.mp3").toString("base64");

const response = await client.chat.completions.create({
  model: "${modelName}",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Transcribe and summarize this audio." },
      { type: "input_audio", input_audio: { data: audioData, format: "mp3" } },
    ],
  }],
});
console.log(response.choices[0].message.content);`,
    };
  }

  // default: text
  return {
    curl: `curl ${host}/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
    python: `from openai import OpenAI

client = OpenAI(
    base_url="${host}/v1",
    api_key="sk-your-key",
)

response = client.chat.completions.create(
    model="${modelName}",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.choices[0].message.content)`,
    js: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${host}/v1",
  apiKey: "sk-your-key",
  dangerouslyAllowBrowser: true,
});

const response = await client.chat.completions.create({
  model: "${modelName}",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(response.choices[0].message.content);`,
  };
}

export default function ModelList() {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [editing, setEditing] = useState<Model | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showUsage, setShowUsage] = useState<Record<string, boolean>>({});
  const [capTab, setCapTab] = useState<Record<string, CapTab>>({});
  const [langTab, setLangTab] = useState<Record<string, LangTab>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const load = () => {
    listModels().then(setModels).catch(console.error);
    listProviders().then(setProviders).catch(console.error);
  };

  useEffect(load, []);

  const groups = useMemo<ModelGroup[]>(() => {
    const map = new Map<string, Model[]>();
    for (const m of models) {
      const arr = map.get(m.name) || [];
      arr.push(m);
      map.set(m.name, arr);
    }
    return Array.from(map.entries()).map(([name, routes]) => ({
      name,
      routes: routes.sort((a, b) => b.priority - a.priority),
    }));
  }, [models]);

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: t.deleteModelConfirm, message: "此路由将被永久移除。", confirmLabel: t.delete, danger: true });
    if (!ok) return;
    try {
      await deleteModel(id);
      toast("模型路由已删除", "success");
      load();
    } catch (e) {
      toast("删除失败：" + (e as Error).message, "error");
    }
  };

  const toggleGroup = (name: string) => {
    setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleUsage = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowUsage((prev) => ({ ...prev, [name]: !prev[name] }));
    setCapTab((prev) => ({ ...prev, [name]: prev[name] || "text" }));
    setLangTab((prev) => ({ ...prev, [name]: prev[name] || "curl" }));
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t.modelMappings}</h2>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={btnStyle}>
          {t.addModel}
        </button>
      </div>

      {showForm && (
        <ModelForm
          model={editing}
          providers={providers}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {groups.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>{t.noModelsYet}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.map((group) => {
            const isCollapsed = collapsed[group.name];
            const usageOpen = showUsage[group.name];
            const caps = groupCaps(group.routes);
            const cTab: CapTab = capTab[group.name] || "text";
            const lTab: LangTab = langTab[group.name] || "curl";
            const snippets = buildSnippets(group.name, cTab);
            const copyKey = `${group.name}-${cTab}-${lTab}`;

            const capTabs: { key: CapTab; label: string }[] = [
              { key: "text", label: t.capText },
              ...(caps.vision ? [{ key: "vision" as CapTab, label: t.capVision }] : []),
              ...(caps.outputImage ? [{ key: "imageGen" as CapTab, label: t.capImageGen }] : []),
              ...(caps.functionCall ? [{ key: "functionCall" as CapTab, label: t.capFunctionCall }] : []),
              ...(caps.audio ? [{ key: "audio" as CapTab, label: t.capAudio }] : []),
            ];

            return (
              <div key={group.name} style={groupCardStyle}>
                {/* Group header */}
                <div onClick={() => toggleGroup(group.name)} style={groupHeaderStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", width: 16 }}>{isCollapsed ? "\u25B6" : "\u25BC"}</span>
                    <strong style={{ fontSize: 16 }}>{group.name}</strong>
                    <span style={routeCountBadge}>{t.nRoutes(group.routes.length)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => toggleUsage(group.name, e)}
                      style={usageOpen ? usageBtnActiveStyle : usageBtnStyle}
                    >
                      {t.usageExample}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditing(null); setShowForm(true); }}
                      style={addRouteBtnStyle}
                    >
                      {t.addRoute}
                    </button>
                  </div>
                </div>

                {/* Usage panel */}
                {usageOpen && (
                  <div style={usagePanelStyle}>
                    {/* Capability tabs */}
                    {capTabs.length > 1 && (
                      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                        {capTabs.map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => setCapTab((prev) => ({ ...prev, [group.name]: key }))}
                            style={cTab === key ? capTabActiveStyle : capTabStyle}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Language tabs + copy */}
                    <div style={{ display: "flex", gap: 0, marginBottom: 10, borderBottom: "1px solid var(--border)" }}>
                      {(["curl", "python", "js"] as LangTab[]).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setLangTab((prev) => ({ ...prev, [group.name]: lang }))}
                          style={lTab === lang ? tabActiveStyle : tabStyle}
                        >
                          {lang === "js" ? "JavaScript" : lang === "python" ? "Python" : "cURL"}
                        </button>
                      ))}
                      <div style={{ flex: 1 }} />
                      <button onClick={() => handleCopy(snippets[lTab], copyKey)} style={copyBtnStyle}>
                        {copiedKey === copyKey ? t.copied : t.copy}
                      </button>
                    </div>

                    <pre style={codeStyle}>{snippets[lTab]}</pre>
                  </div>
                )}

                {/* Routes table */}
                {!isCollapsed && (
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>{t.provider}</th>
                        <th style={thStyle}>{t.providerModel}</th>
                        <th style={thStyle}>{t.capabilities}</th>
                        <th style={thStyle}>{t.priority}</th>
                        <th style={thStyle}>{t.weight}</th>
                        <th style={thStyle}>{t.enabled}</th>
                        <th style={thStyle}>{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.routes.map((m) => (
                        <tr key={m.id}>
                          <td style={tdStyle}>{m.provider?.name || "\u2014"}</td>
                          <td style={tdStyle}><code>{m.provider_model}</code></td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {m.input_image && <span style={capTag("var(--accent-bg)", "var(--accent)")}>{"\u2191"}{t.image}</span>}
                              {m.input_audio && <span style={capTag("var(--warning-bg)", "var(--warning-text)")}>{"\u2191"}{t.audio}</span>}
                              {m.input_video && <span style={capTag("var(--danger-bg)", "var(--danger-text)")}>{"\u2191"}{t.video}</span>}
                              {m.output_audio && <span style={capTag("var(--success-bg)", "var(--success-text)")}>{"\u2193"}{t.audio}</span>}
                              {m.output_image && <span style={capTag("var(--accent-bg)", "var(--accent)")}>{"\u2193"}{t.image}</span>}
                              {m.function_call && <span style={capTag("var(--accent-bg)", "var(--accent)")}>{t.tools}</span>}
                              {m.reasoning && <span style={capTag("var(--warning-bg)", "var(--warning-text)")}>{t.reasoning}</span>}
                            </div>
                          </td>
                          <td style={tdStyle}>{m.priority}</td>
                          <td style={tdStyle}>{m.weight}</td>
                          <td style={tdStyle}>
                            <span style={{ color: m.enabled ? "var(--success)" : "var(--danger)" }}>
                              {m.enabled ? t.yes : t.no}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <button onClick={() => { setEditing(m); setShowForm(true); }} style={linkBtn}>{t.edit}</button>
                            <button onClick={() => handleDelete(m.id)} style={{ ...linkBtn, color: "var(--danger)" }}>{t.delete}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const capTag = (bg: string, color: string): React.CSSProperties => ({
  padding: "2px 8px", borderRadius: 4, fontSize: 12, background: bg, color,
});

const groupCardStyle: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden",
};
const groupHeaderStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "12px 16px", background: "var(--surface)", cursor: "pointer",
  borderBottom: "1px solid var(--border)",
};
const routeCountBadge: React.CSSProperties = {
  padding: "2px 10px", borderRadius: 12, fontSize: 12,
  background: "var(--accent-bg)", color: "var(--accent)",
};
const addRouteBtnStyle: React.CSSProperties = {
  padding: "4px 12px", background: "none", border: "1px solid var(--accent)",
  borderRadius: 4, color: "var(--accent)", cursor: "pointer", fontSize: 12,
};
const usageBtnStyle: React.CSSProperties = {
  padding: "4px 12px", background: "none", border: "1px solid var(--border)",
  borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", fontSize: 12,
};
const usageBtnActiveStyle: React.CSSProperties = {
  ...usageBtnStyle, background: "var(--accent-bg)", border: "1px solid var(--accent)", color: "var(--accent)",
};
const usagePanelStyle: React.CSSProperties = {
  padding: "12px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)",
};
const capTabStyle: React.CSSProperties = {
  padding: "3px 12px", background: "var(--bg)", border: "1px solid var(--border)",
  borderRadius: 20, cursor: "pointer", fontSize: 12, color: "var(--text-secondary)",
};
const capTabActiveStyle: React.CSSProperties = {
  ...capTabStyle, background: "var(--accent-bg)", border: "1px solid var(--accent)", color: "var(--accent)", fontWeight: 600,
};
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
  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6,
  padding: "12px 16px", fontSize: 13, lineHeight: 1.6,
  overflowX: "auto", whiteSpace: "pre", margin: 0, fontFamily: "monospace",
  color: "var(--text)",
};
const btnStyle: React.CSSProperties = {
  padding: "8px 16px", background: "var(--accent)", color: "var(--accent-text)",
  border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14,
};
const linkBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--accent)",
  cursor: "pointer", fontSize: 14, marginRight: 8,
};
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "8px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)",
};
const tdStyle: React.CSSProperties = {
  padding: "8px 16px", borderBottom: "1px solid var(--border)", fontSize: 14,
};
