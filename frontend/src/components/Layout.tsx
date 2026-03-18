import { useState, useEffect, type ReactNode } from "react";
import { listProviders, setAdminToken, clearAdminToken, getVersion, type VersionInfo } from "../api/client";
import { useI18n, LANGS, LANG_LABELS, type Lang } from "../i18n";
import { useTheme, type Theme } from "../theme";

const tabKeys = ["Providers", "Models", "API Keys", "Chat", "Usage", "Logs", "Docs", "Settings"] as const;
type Tab = (typeof tabKeys)[number];

/* ── SVG Icons ── */
const IconProviders = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="4" rx="1"/><rect x="2" y="10" width="20" height="4" rx="1"/>
    <rect x="2" y="17" width="20" height="4" rx="1"/>
    <circle cx="19" cy="5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="19" r="1" fill="currentColor" stroke="none"/>
  </svg>
);
const IconModels = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
  </svg>
);
const IconKeys = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/>
  </svg>
);
const IconChat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconUsage = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);
const IconLogs = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);
const IconDocs = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IconSun = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const IconMoon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);
const IconMonitor = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);
const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const navIcons: Record<Tab, ReactNode> = {
  Providers: <IconProviders />,
  Models: <IconModels />,
  "API Keys": <IconKeys />,
  Chat: <IconChat />,
  Usage: <IconUsage />,
  Logs: <IconLogs />,
  Docs: <IconDocs />,
  Settings: <IconSettings />,
};

/* ── Bird logo ── */
function BirdLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="36" rx="18" ry="14" fill="var(--accent)" opacity="0.9" />
      <path d="M14 30 Q8 18 22 14 Q16 24 20 32 Z" fill="var(--accent)" opacity="0.7" />
      <path d="M50 30 Q56 18 42 14 Q48 24 44 32 Z" fill="var(--accent)" opacity="0.7" />
      <circle cx="32" cy="20" r="10" fill="var(--accent)" />
      <circle cx="29" cy="18" r="2" fill="var(--bg)" />
      <circle cx="35" cy="18" r="2" fill="var(--bg)" />
      <circle cx="29.5" cy="18" r="1" fill="var(--text)" />
      <circle cx="35.5" cy="18" r="1" fill="var(--text)" />
      <path d="M30 23 L32 28 L34 23" fill="var(--warning)" strokeLinejoin="round" />
      <path d="M26 48 Q24 56 20 58 Q28 54 32 48" fill="var(--accent)" opacity="0.6" />
      <path d="M38 48 Q40 56 44 58 Q36 54 32 48" fill="var(--accent)" opacity="0.6" />
    </svg>
  );
}

export default function Layout({ children }: { children: Record<Tab, ReactNode> }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [active, setActive] = useState<Tab>("Providers");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  useEffect(() => { getVersion().then(setVersionInfo).catch(() => {}); }, []);
  useEffect(() => {
    listProviders().catch((e: Error & { status?: number }) => {
      if (e.status === 401) setNeedsAuth(true);
    });
  }, []);
  useEffect(() => {
    if (!showThemeMenu) return;
    const h = () => setShowThemeMenu(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [showThemeMenu]);

  const tabLabels: Record<Tab, string> = {
    Providers: t.tabProviders,
    Models: t.tabModels,
    "API Keys": t.tabAPIKeys,
    Chat: t.tabChat,
    Usage: t.tabUsage,
    Logs: t.tabLogs,
    Docs: t.tabDocs,
    Settings: t.tabSettings,
  };

  const handleLogin = () => { setAdminToken(tokenInput); setTokenInput(""); setNeedsAuth(false); };
  const handleLogout = () => { clearAdminToken(); setNeedsAuth(true); };

  const themeIcon = (t: Theme) => t === "light" ? <IconSun /> : t === "dark" ? <IconMoon /> : <IconMonitor />;
  const themeOpts: { value: Theme; label: string; icon: ReactNode }[] = [
    { value: "light", label: "Light", icon: <IconSun /> },
    { value: "dark", label: "Dark", icon: <IconMoon /> },
    { value: "system", label: "System", icon: <IconMonitor /> },
  ];

  /* ── Login screen ── */
  if (needsAuth) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)", padding: 20,
      }}>
        <div style={{
          width: "100%", maxWidth: 380,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, padding: "32px 28px",
          boxShadow: "var(--shadow-lg)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <BirdLogo size={32} />
            <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>灵雀</span>
          </div>
          <p style={{ color: "var(--text-muted)", margin: "0 0 20px", fontSize: 13 }}>{t.adminTokenRequired}</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={t.enterAdminToken}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{ width: "100%", marginBottom: 12 }}
          />
          <button onClick={handleLogin} style={btnPrimary}>{t.login}</button>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 16 }}>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} style={ctrlSelect}>
              {LANGS.map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
            </select>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main layout ── */
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: "var(--sidebar-w)", flexShrink: 0,
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        display: "flex", flexDirection: "column",
        height: "100vh", overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          padding: "20px 18px 16px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <BirdLogo size={26} />
            <div>
              <div style={{
                fontSize: 15, fontWeight: 700, color: "var(--text)",
                letterSpacing: "-0.02em", lineHeight: 1.2,
              }}>灵雀</div>
              {versionInfo && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  {versionInfo.version}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "10px 10px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1 }}>
          {tabKeys.filter((tab) => tab !== "Settings").map((tab) => {
            const isActive = active === tab;
            return (
              <button
                key={tab}
                onClick={() => setActive(tab)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "8px 10px",
                  border: "none", borderRadius: 8,
                  background: isActive ? "var(--accent-bg)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-muted)",
                  cursor: "pointer", fontSize: 13, fontWeight: isActive ? 600 : 400,
                  textAlign: "left", marginBottom: 2,
                  transition: "background 0.12s, color 0.12s",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <span style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0 }}>{navIcons[tab]}</span>
                {tabLabels[tab]}
              </button>
            );
          })}
          </div>
          {/* Settings pinned at bottom of nav */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
            {(() => {
              const isActive = active === "Settings";
              return (
                <button
                  onClick={() => setActive("Settings")}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "8px 10px",
                    border: "none", borderRadius: 8,
                    background: isActive ? "var(--accent-bg)" : "transparent",
                    color: isActive ? "var(--accent)" : "var(--text-muted)",
                    cursor: "pointer", fontSize: 13, fontWeight: isActive ? 600 : 400,
                    textAlign: "left",
                    transition: "background 0.12s, color 0.12s",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0 }}>{navIcons["Settings"]}</span>
                  {tabLabels["Settings"]}
                </button>
              );
            })()}
          </div>
        </nav>

        {/* Sidebar footer: controls */}
        <div style={{
          padding: "12px 10px",
          borderTop: "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {/* Theme picker */}
          <div style={{ position: "relative" }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowThemeMenu(!showThemeMenu); }}
              style={{
                ...ctrlBtn,
                display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "flex-start",
              }}
            >
              {themeIcon(theme)}
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System"}
              </span>
            </button>
            {showThemeMenu && (
              <div style={{
                position: "absolute", bottom: "110%", left: 0,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 10, boxShadow: "var(--shadow-lg)", zIndex: 100,
                overflow: "hidden", minWidth: 130,
              }}>
                {themeOpts.map((o) => (
                  <button key={o.value} onClick={() => { setTheme(o.value); setShowThemeMenu(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "9px 14px",
                      border: "none", background: theme === o.value ? "var(--accent-bg)" : "transparent",
                      color: theme === o.value ? "var(--accent)" : "var(--text-secondary)",
                      cursor: "pointer", fontSize: 12, textAlign: "left",
                    }}
                  >
                    {o.icon} {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language select */}
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} style={ctrlSelect}>
            {LANGS.map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>

          {/* Logout */}
          {localStorage.getItem("admin_token") && (
            <button onClick={handleLogout} style={{
              ...ctrlBtn,
              display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "flex-start",
              color: "var(--danger)",
            }}>
              <IconLogout />
              <span style={{ fontSize: 12 }}>{t.logout}</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── Content ── */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        height: "100vh", overflow: "hidden",
      }}>
        {/* Top bar */}
        <header style={{
          borderBottom: "1px solid var(--border)",
          padding: "14px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0, background: "var(--surface)",
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>
              {tabLabels[active]}
            </h1>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {t.appSubtitle}
          </div>
        </header>

        {/* Page content */}
        <div style={{
          flex: 1, minHeight: 0,
          overflowY: active === "Chat" ? "hidden" : "auto",
          padding: active === "Chat" ? 0 : "28px 32px",
          display: "flex", flexDirection: "column",
        }}>
          {children[active]}
        </div>
      </main>
    </div>
  );
}

/* ── Shared micro-styles ── */
const btnPrimary: React.CSSProperties = {
  width: "100%", padding: "9px 16px",
  background: "var(--accent)", color: "var(--accent-text)",
  border: "none", borderRadius: 8, cursor: "pointer",
  fontSize: 14, fontWeight: 500,
};

const ctrlBtn: React.CSSProperties = {
  padding: "7px 10px", background: "transparent",
  border: "none", borderRadius: 7,
  cursor: "pointer", color: "var(--text-muted)",
};

const ctrlSelect: React.CSSProperties = {
  width: "100%", padding: "7px 10px",
  borderRadius: 7, border: "1px solid var(--border)",
  fontSize: 12, cursor: "pointer",
  background: "var(--surface-2)", color: "var(--text-secondary)",
};
