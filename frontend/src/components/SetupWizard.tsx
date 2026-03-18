import { useState } from "react";
import { updateConfig, restartSidecar, type ConfigUpdateRequest } from "../api/client";
import { useI18n } from "../i18n";

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "lr-";
  for (let i = 0; i < 32; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

interface SetupWizardProps {
  onComplete: () => void;
}

type Step = "welcome" | "server" | "security" | "behavior" | "done";
const STEPS: Step[] = ["welcome", "server", "security", "behavior", "done"];

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("welcome");
  const [host, setHost] = useState("0.0.0.0");
  const [port, setPort] = useState("8080");
  const [authToken, setAuthToken] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [logRequests, setLogRequests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stepIdx = STEPS.indexOf(step);

  const goNext = () => setStep(STEPS[stepIdx + 1]);
  const goBack = () => setStep(STEPS[stepIdx - 1]);

  const handleFinish = async () => {
    setSaving(true);
    setError("");
    try {
      const data: ConfigUpdateRequest = {
        host,
        port,
        auth_token: authToken,
        default_model: defaultModel,
        log_requests: logRequests,
      };
      await updateConfig(data);

      if (isTauri()) {
        try { await restartSidecar(); } catch { /* ignore restart error */ }
      }

      localStorage.setItem("wizard_done", "1");
      onComplete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("wizard_done", "1");
    onComplete();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: "100%", maxWidth: 480,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "36px 32px",
        boxShadow: "var(--shadow-lg)",
      }}>
        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{
              width: 8, height: 8, borderRadius: 4,
              background: i <= stepIdx ? "var(--accent)" : "var(--border)",
              transition: "background 0.2s",
            }} />
          ))}
        </div>

        {/* Step content */}
        {step === "welcome" && (
          <StepContent title={t.wizardWelcomeTitle} desc={t.wizardWelcomeDesc}>
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button onClick={goNext} style={btnPrimary}>{t.wizardGetStarted}</button>
              <div style={{ marginTop: 12 }}>
                <button onClick={handleSkip} style={btnLink}>{t.wizardSkip}</button>
              </div>
            </div>
          </StepContent>
        )}

        {step === "server" && (
          <StepContent title={t.wizardServerTitle} desc={t.wizardServerDesc}>
            <FormField label={t.settingsHost}>
              <input value={host} onChange={(e) => setHost(e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label={t.settingsPort}>
              <input value={port} onChange={(e) => setPort(e.target.value)} style={inputStyle} />
            </FormField>
          </StepContent>
        )}

        {step === "security" && (
          <StepContent title={t.wizardSecurityTitle} desc={t.wizardSecurityDesc}>
            <FormField label={t.settingsAuthToken}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={() => setAuthToken(generateToken())} style={btnSmall}>
                  {t.settingsGenerate}
                </button>
              </div>
            </FormField>
          </StepContent>
        )}

        {step === "behavior" && (
          <StepContent title={t.wizardBehaviorTitle} desc={t.wizardBehaviorDesc}>
            <FormField label={t.settingsDefaultModel}>
              <input value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} style={inputStyle} />
            </FormField>
            <FormField label={t.settingsLogRequests}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={logRequests} onChange={(e) => setLogRequests(e.target.checked)} />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{logRequests ? t.yes : t.no}</span>
              </label>
            </FormField>
          </StepContent>
        )}

        {step === "done" && (
          <StepContent title={t.wizardDoneTitle} desc={t.wizardDoneDesc}>
            {error && (
              <div style={{
                padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13,
                background: "var(--danger-bg, #ffeaea)", color: "var(--danger)",
                border: "1px solid var(--danger)",
              }}>
                {error}
              </div>
            )}
          </StepContent>
        )}

        {/* Navigation buttons */}
        {step !== "welcome" && (
          <div style={{
            display: "flex", justifyContent: "space-between", marginTop: 24, gap: 12,
          }}>
            <button onClick={goBack} disabled={step === "done" && saving} style={btnSecondary}>
              {t.wizardBack}
            </button>
            {step === "done" ? (
              <button onClick={handleFinish} disabled={saving} style={btnPrimary}>
                {saving ? t.saving : t.wizardFinish}
              </button>
            ) : (
              <button onClick={goNext} style={btnPrimary}>{t.wizardNext}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepContent({ title, desc, children }: { title: string; desc: string; children?: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600, color: "var(--text)", textAlign: "center" }}>
        {title}
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
        {desc}
      </p>
      {children}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
        {label}
      </label>
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
  padding: "9px 24px",
  background: "var(--accent)", color: "var(--accent-text)",
  border: "none", borderRadius: 8, cursor: "pointer",
  fontSize: 14, fontWeight: 500,
};

const btnSecondary: React.CSSProperties = {
  padding: "9px 20px",
  background: "var(--surface-2)", color: "var(--text-secondary)",
  border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer",
  fontSize: 13,
};

const btnSmall: React.CSSProperties = {
  padding: "7px 12px",
  background: "var(--surface-2)", color: "var(--text-secondary)",
  border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer",
  fontSize: 12, whiteSpace: "nowrap",
};

const btnLink: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--text-muted)", fontSize: 12, textDecoration: "underline",
};
