import { useState, useEffect } from "react";
import { getConfig, updateConfig, restartSidecar, type AppConfig, type ConfigUpdateRequest } from "../api/client";
import { useI18n } from "../i18n";
import { Skeleton } from "./ui/Skeleton";

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "lr-";
  for (let i = 0; i < 32; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

export default function SettingsPage() {
  const { t } = useI18n();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [tokenTouched, setTokenTouched] = useState(false);
  const [defaultModel, setDefaultModel] = useState("");
  const [logRequests, setLogRequests] = useState(false);
  const [autostart, setAutostart] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "warn"; text: string } | null>(null);
  const [restartRequired, setRestartRequired] = useState(false);
  const [searchProvider, setSearchProvider] = useState<"tavily" | "serper" | "">("");
  const [searchAPIKey, setSearchAPIKey] = useState("");
  const [searchKeyTouched, setSearchKeyTouched] = useState(false);

  useEffect(() => {
    getConfig().then((cfg) => {
      setConfig(cfg);
      setHost(cfg.host);
      setPort(cfg.port);
      setAuthToken(cfg.auth_token);
      setDefaultModel(cfg.default_model);
      setLogRequests(cfg.log_requests);
      setSearchProvider((cfg.search_provider as "tavily" | "serper" | "") || "");
      setSearchAPIKey(cfg.search_api_key || "");
    });
    if (isTauri()) {
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke<boolean>("is_autostart_enabled").then(setAutostart).catch(() => {});
      });
    }
  }, []);

  const handleAutostartToggle = async (val: boolean) => {
    setAutostart(val);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_autostart", { enabled: val });
    } catch (e) {
      console.error("autostart toggle failed", e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const data: ConfigUpdateRequest = {
        host,
        port,
        log_requests: logRequests,
        default_model: defaultModel,
        search_provider: searchProvider,
      };
      if (tokenTouched) {
        data.auth_token = authToken;
      }
      if (searchKeyTouched) {
        data.search_api_key = searchAPIKey;
      }
      const res = await updateConfig(data);
      setMessage({ type: "success", text: t.settingsSaved });
      setTokenTouched(false);
      setSearchKeyTouched(false);
      if (res.restart_required) {
        setRestartRequired(true);
      }
    } catch (e: unknown) {
      setMessage({ type: "error", text: t.settingsSaveFailed + ": " + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    try {
      await restartSidecar();
      setRestartRequired(false);
      setMessage({ type: "success", text: t.settingsRestartSuccess });
      // Reload config to reflect new state
      const cfg = await getConfig();
      setConfig(cfg);
      setHost(cfg.host);
      setPort(cfg.port);
      setAuthToken(cfg.auth_token);
      setDefaultModel(cfg.default_model);
      setLogRequests(cfg.log_requests);
    } catch (e: unknown) {
      setMessage({ type: "error", text: String(e instanceof Error ? e.message : e) });
    }
  };

  if (!config) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}>
      {[0,1,2,3].map(i => <Skeleton key={i} height={48} radius={8} />)}
    </div>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Message banner */}
      {message && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 20, fontSize: 13,
          background: message.type === "success" ? "var(--success-bg, #e8f5e9)" : message.type === "error" ? "var(--danger-bg, #ffeaea)" : "var(--warning-bg, #fff8e1)",
          color: message.type === "success" ? "var(--success, #2e7d32)" : message.type === "error" ? "var(--danger)" : "var(--warning)",
          border: `1px solid ${message.type === "success" ? "var(--success, #2e7d32)" : message.type === "error" ? "var(--danger)" : "var(--warning)"}`,
        }}>
          {message.text}
        </div>
      )}

      {/* Restart banner */}
      {restartRequired && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 20, fontSize: 13,
          background: "var(--warning-bg, #fff8e1)", border: "1px solid var(--warning)",
          color: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <span>{isTauri() ? t.settingsRestartRequired : t.settingsRestartManual}</span>
          {isTauri() && (
            <button onClick={handleRestart} style={btnSmall}>
              {t.settingsRestartBtn}
            </button>
          )}
        </div>
      )}

      {/* Server section */}
      <SectionTitle>{t.settingsServer}</SectionTitle>
      <FormField label={t.settingsHost} help={t.settingsHostHelp}>
        <input value={host} onChange={(e) => setHost(e.target.value)} style={inputStyle} />
      </FormField>
      <FormField label={t.settingsPort} help={t.settingsPortHelp}>
        <input value={port} onChange={(e) => setPort(e.target.value)} style={inputStyle} />
      </FormField>

      {/* Security section */}
      <SectionTitle>{t.settingsSecurity}</SectionTitle>
      <FormField label={t.settingsAuthToken} help={t.settingsAuthTokenHelp}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={authToken}
            onChange={(e) => { setAuthToken(e.target.value); setTokenTouched(true); }}
            style={{ ...inputStyle, flex: 1 }}
            placeholder=""
          />
          <button
            onClick={() => { setAuthToken(generateToken()); setTokenTouched(true); }}
            style={btnSmall}
          >
            {t.settingsGenerate}
          </button>
        </div>
      </FormField>

      {/* Behavior section */}
      <SectionTitle>{t.settingsBehavior}</SectionTitle>
      <FormField label={t.settingsDefaultModel} help={t.settingsDefaultModelHelp}>
        <input value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} style={inputStyle} />
      </FormField>
      <FormField label={t.settingsLogRequests} help={t.settingsLogRequestsHelp}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={logRequests}
            onChange={(e) => setLogRequests(e.target.checked)}
          />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{logRequests ? t.yes : t.no}</span>
        </label>
      </FormField>

      {/* Desktop section — Tauri only */}
      {isTauri() && (
        <>
          <SectionTitle>{t.settingsDesktop}</SectionTitle>
          <FormField label={t.settingsAutostart} help={t.settingsAutostartHelp}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autostart}
                onChange={(e) => handleAutostartToggle(e.target.checked)}
              />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{autostart ? t.yes : t.no}</span>
            </label>
          </FormField>
        </>
      )}

      {/* Web search section */}
      <SectionTitle>联网搜索</SectionTitle>
      <FormField label="搜索引擎" help="选择用于 Chat 联网搜索的服务商">
        <div style={{ display: "flex", gap: 8 }}>
          {(["tavily", "serper", ""] as const).map((p) => (
            <button
              key={p}
              onClick={() => setSearchProvider(p)}
              style={{
                padding: "7px 14px", borderRadius: 7, fontSize: 13, cursor: "pointer",
                border: `1px solid ${searchProvider === p ? "var(--accent)" : "var(--border)"}`,
                background: searchProvider === p ? "var(--accent-bg)" : "var(--surface-2)",
                color: searchProvider === p ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: searchProvider === p ? 600 : 400,
              }}
            >
              {p === "" ? "禁用" : p === "tavily" ? "Tavily" : "Serper"}
            </button>
          ))}
        </div>
        {searchProvider === "tavily" && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            免费 <strong>1,000 次/月</strong>，每月自动重置。超出后 $0.008/次。
            注册获取 Key：<a href="https://app.tavily.com/home" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>app.tavily.com</a>
          </div>
        )}
        {searchProvider === "serper" && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            注册赠送 <strong>2,500 次</strong>（一次性，不重置）。超出后按量付费。
            注册获取 Key：<a href="https://serper.dev" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>serper.dev</a>
          </div>
        )}
      </FormField>
      {searchProvider !== "" && (
        <FormField label="API Key" help="保存后自动脱敏显示">
          <input
            type="password"
            value={searchAPIKey}
            onChange={(e) => { setSearchAPIKey(e.target.value); setSearchKeyTouched(true); }}
            placeholder={searchAPIKey.startsWith("****") ? searchAPIKey : "粘贴 API Key…"}
            style={{ ...inputStyle }}
            autoComplete="off"
          />
        </FormField>
      )}

      {/* Save button */}
      <div style={{ marginTop: 24 }}>
        <button onClick={handleSave} disabled={saving} style={btnPrimary}>
          {saving ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: 13, fontWeight: 600, color: "var(--text-muted)",
      textTransform: "uppercase", letterSpacing: "0.04em",
      margin: "24px 0 12px", paddingBottom: 6,
      borderBottom: "1px solid var(--border)",
    }}>
      {children}
    </h3>
  );
}

function FormField({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
        {label}
      </label>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{help}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px",
  borderRadius: 7, border: "1px solid var(--border)",
  fontSize: 13, background: "var(--surface-2)", color: "var(--text)",
};

const btnPrimary: React.CSSProperties = {
  padding: "9px 20px",
  background: "var(--accent)", color: "var(--accent-text)",
  border: "none", borderRadius: 8, cursor: "pointer",
  fontSize: 13, fontWeight: 500,
};

const btnSmall: React.CSSProperties = {
  padding: "7px 12px",
  background: "var(--surface-2)", color: "var(--text-secondary)",
  border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer",
  fontSize: 12, whiteSpace: "nowrap",
};
