import { useState } from "react";
import type { Provider, Protocol } from "../types";
import { createProvider, updateProvider } from "../api/client";
import { useI18n } from "../i18n";

interface Props {
  provider: Provider | null;
  onSaved: () => void;
  onCancel: () => void;
}

export interface ProviderPreset {
  label: string;
  name: string;
  baseUrl: string;
  protocol: Protocol;
  signupUrl: string;
  docsUrl: string;
  category: "global" | "china" | "local";
  noKey?: boolean; // no API key needed (e.g. Ollama)
}

export const PRESETS: ProviderPreset[] = [
  // ── Global ──────────────────────────────────────────────────────────────
  {
    label: "OpenAI",
    name: "openai",
    baseUrl: "https://api.openai.com/v1",
    protocol: "openai",
    signupUrl: "https://platform.openai.com/api-keys",
    docsUrl: "https://platform.openai.com/docs",
    category: "global",
  },
  {
    label: "Anthropic",
    name: "anthropic",
    baseUrl: "https://api.anthropic.com",
    protocol: "anthropic",
    signupUrl: "https://console.anthropic.com/",
    docsUrl: "https://docs.anthropic.com",
    category: "global",
  },
  {
    label: "Gemini",
    name: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    protocol: "openai",
    signupUrl: "https://aistudio.google.com/app/apikey",
    docsUrl: "https://ai.google.dev/gemini-api/docs/openai",
    category: "global",
  },
  {
    label: "xAI (Grok)",
    name: "xai",
    baseUrl: "https://api.x.ai/v1",
    protocol: "openai",
    signupUrl: "https://console.x.ai/",
    docsUrl: "https://docs.x.ai/api",
    category: "global",
  },
  {
    label: "Mistral",
    name: "mistral",
    baseUrl: "https://api.mistral.ai/v1",
    protocol: "openai",
    signupUrl: "https://console.mistral.ai/api-keys/",
    docsUrl: "https://docs.mistral.ai",
    category: "global",
  },
  {
    label: "Cohere",
    name: "cohere",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    protocol: "openai",
    signupUrl: "https://dashboard.cohere.com/api-keys",
    docsUrl: "https://docs.cohere.com",
    category: "global",
  },
  {
    label: "Perplexity",
    name: "perplexity",
    baseUrl: "https://api.perplexity.ai",
    protocol: "openai",
    signupUrl: "https://www.perplexity.ai/settings/api",
    docsUrl: "https://docs.perplexity.ai",
    category: "global",
  },
  {
    label: "Groq",
    name: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    protocol: "openai",
    signupUrl: "https://console.groq.com/keys",
    docsUrl: "https://console.groq.com/docs",
    category: "global",
  },
  {
    label: "Together AI",
    name: "together",
    baseUrl: "https://api.together.xyz/v1",
    protocol: "openai",
    signupUrl: "https://api.together.xyz/settings/api-keys",
    docsUrl: "https://docs.together.ai",
    category: "global",
  },
  // ── China ───────────────────────────────────────────────────────────────
  {
    label: "SiliconFlow",
    name: "siliconflow",
    baseUrl: "https://api.siliconflow.cn/v1",
    protocol: "openai",
    signupUrl: "https://cloud.siliconflow.cn/account/ak",
    docsUrl: "https://docs.siliconflow.cn",
    category: "china",
  },
  {
    label: "DeepSeek",
    name: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    protocol: "openai",
    signupUrl: "https://platform.deepseek.com/api_keys",
    docsUrl: "https://platform.deepseek.com/api-docs",
    category: "china",
  },
  {
    label: "Moonshot",
    name: "moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    protocol: "openai",
    signupUrl: "https://platform.moonshot.cn/console/api-keys",
    docsUrl: "https://platform.moonshot.cn/docs",
    category: "china",
  },
  {
    label: "零一万物",
    name: "lingyiwanwu",
    baseUrl: "https://api.lingyiwanwu.com/v1",
    protocol: "openai",
    signupUrl: "https://platform.lingyiwanwu.com/apikeys",
    docsUrl: "https://platform.lingyiwanwu.com/docs",
    category: "china",
  },
  {
    label: "阿里百炼",
    name: "dashscope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    protocol: "openai",
    signupUrl: "https://dashscope.console.aliyun.com/apiKey",
    docsUrl: "https://help.aliyun.com/zh/dashscope/",
    category: "china",
  },
  {
    label: "智谱 AI",
    name: "zhipuai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    protocol: "openai",
    signupUrl: "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
    docsUrl: "https://bigmodel.cn/dev/api",
    category: "china",
  },
  {
    label: "百度千帆",
    name: "qianfan",
    baseUrl: "https://qianfan.baidubce.com/v2",
    protocol: "openai",
    signupUrl: "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application",
    docsUrl: "https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html",
    category: "china",
  },
  {
    label: "火山方舟",
    name: "volcengine-ark",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    protocol: "openai",
    signupUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    docsUrl: "https://www.volcengine.com/docs/82379/1263512",
    category: "china",
  },
  // ── Local ────────────────────────────────────────────────────────────────
  {
    label: "Ollama",
    name: "ollama",
    baseUrl: "http://localhost:11434/v1",
    protocol: "openai",
    signupUrl: "",
    docsUrl: "https://ollama.com/",
    category: "local",
    noKey: true,
  },
];

export default function ProviderForm({ provider, onSaved, onCancel }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(provider?.name || "");
  const [baseUrl, setBaseUrl] = useState(provider?.base_url || "");
  const [apiKey, setApiKey] = useState(provider?.api_key || "");
  const [protocol, setProtocol] = useState<Protocol>(provider?.protocol || "openai");
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [categoryTab, setCategoryTab] = useState<"global" | "china" | "local">("global");
  const [noKeyRequired, setNoKeyRequired] = useState(() => {
    if (!provider) return false;
    return PRESETS.some((p) => p.noKey && provider.base_url.startsWith(p.baseUrl.replace(/\/v1\/?$/, "")));
  });

  const applyPreset = (preset: ProviderPreset) => {
    setName(preset.name);
    setBaseUrl(preset.baseUrl);
    setProtocol(preset.protocol);
    setSelectedPreset(preset.name);
    setNoKeyRequired(!!preset.noKey);
    if (preset.noKey) setApiKey("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = { name, base_url: baseUrl, api_key: apiKey, protocol, enabled };
      if (provider) {
        await updateProvider(provider.id, data);
      } else {
        await createProvider(data);
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <h3 style={{ marginTop: 0 }}>{provider ? t.editProvider : t.addProviderTitle}</h3>
      {error && <div style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</div>}

      {/* Preset picker — shown when adding */}
      {!provider && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{t.quickFill}</div>
          {/* Category tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 10 }}>
            {(["global", "china", "local"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryTab(cat)}
                style={{
                  padding: "4px 14px", background: "none", border: "none",
                  borderBottom: categoryTab === cat ? "2px solid var(--accent)" : "2px solid transparent",
                  cursor: "pointer", fontSize: 13, marginBottom: -1,
                  color: categoryTab === cat ? "var(--accent)" : "var(--text-muted)",
                  fontWeight: categoryTab === cat ? 600 : 400,
                }}
              >
                {cat === "global" ? "Global" : cat === "china" ? "国内" : "Local"}
              </button>
            ))}
          </div>
          {/* Preset cards */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PRESETS.filter((p) => p.category === categoryTab).map((preset) => (
              <div key={preset.name} style={presetCardStyle(selectedPreset === preset.name)}>
                <button
                  type="button"
                  onClick={() => applyPreset(preset)}
                  style={presetNameStyle(selectedPreset === preset.name)}
                >
                  {preset.label}
                </button>
                <div style={{ display: "flex", gap: 4 }}>
                  {preset.signupUrl && (
                    <a href={preset.signupUrl} target="_blank" rel="noreferrer" style={presetLinkStyle}>
                      {t.signUp}
                    </a>
                  )}
                  <a href={preset.docsUrl} target="_blank" rel="noreferrer" style={presetLinkStyle}>
                    {t.docs}
                  </a>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{t.orFillManually}</div>
        </div>
      )}

      {/* Matched preset links — shown when editing */}
      {provider && (() => {
        const matched = PRESETS.find((p) => baseUrl.startsWith(p.baseUrl.replace(/\/v1\/?$/, "")));
        if (!matched) return null;
        return (
          <div style={{ marginBottom: 14, padding: "8px 12px", background: "var(--accent-bg)", borderRadius: 6, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: "var(--accent)" }}>{matched.label}</span>
            {matched.signupUrl && (
              <a href={matched.signupUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{t.signUp} →</a>
            )}
            <a href={matched.docsUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{t.docs} →</a>
          </div>
        );
      })()}

      <div style={fieldStyle}>
        <label>{t.name}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.providerNamePlaceholder} required style={inputStyle} />
      </div>
      <div style={fieldStyle}>
        <label>{t.baseUrl}</label>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t.providerUrlPlaceholder} required style={inputStyle} />
      </div>
      <div style={fieldStyle}>
        <label>{t.apiKey}</label>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={noKeyRequired ? "Not required" : t.providerKeyPlaceholder}
          required={!noKeyRequired}
          disabled={noKeyRequired}
          style={{ ...inputStyle, opacity: noKeyRequired ? 0.5 : 1 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>
          <input
            type="checkbox"
            checked={noKeyRequired}
            onChange={(e) => { setNoKeyRequired(e.target.checked); if (e.target.checked) setApiKey(""); }}
          />
          No API key required (e.g. Ollama)
        </label>
      </div>
      <div style={fieldStyle}>
        <label>{t.protocol}</label>
        <select value={protocol} onChange={(e) => setProtocol(e.target.value as Protocol)} style={inputStyle}>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </div>
      <div style={fieldStyle}>
        <label>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {" "}{t.enabled}
        </label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving} style={btnStyle}>
          {saving ? t.saving : t.save}
        </button>
        <button type="button" onClick={onCancel} style={cancelBtn}>{t.cancel}</button>
      </div>
    </form>
  );
}

const presetCardStyle = (active: boolean): React.CSSProperties => ({
  display: "flex", flexDirection: "column", gap: 4,
  padding: "6px 10px", borderRadius: 6, fontSize: 12,
  border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
  background: active ? "var(--accent-bg)" : "var(--surface)",
  minWidth: 80,
});
const presetNameStyle = (active: boolean): React.CSSProperties => ({
  background: "none", border: "none", padding: 0, cursor: "pointer",
  fontWeight: 600, fontSize: 13, color: active ? "var(--accent)" : "var(--text)",
  textAlign: "left",
});
const presetLinkStyle: React.CSSProperties = {
  fontSize: 11, color: "var(--accent)", textDecoration: "none",
};

const formStyle: React.CSSProperties = {
  background: "var(--surface)", padding: 20, borderRadius: 8, marginBottom: 20, border: "1px solid var(--border)",
};
const fieldStyle: React.CSSProperties = { marginBottom: 12 };
const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
  borderRadius: 6, fontSize: 14, marginTop: 4, boxSizing: "border-box",
  background: "var(--bg)", color: "var(--text)",
};
const btnStyle: React.CSSProperties = {
  padding: "8px 20px", background: "var(--accent)", color: "var(--accent-text)",
  border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14,
};
const cancelBtn: React.CSSProperties = {
  ...btnStyle, background: "var(--text-muted)",
};
