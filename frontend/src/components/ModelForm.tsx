import { useState } from "react";
import type { Model, Provider } from "../types";
import { createModel, updateModel } from "../api/client";
import { useI18n } from "../i18n";

interface Props {
  model: Model | null;
  providers: Provider[];
  onSaved: () => void;
  onCancel: () => void;
}

export default function ModelForm({ model, providers, onSaved, onCancel }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(model?.name || "");
  const [providerId, setProviderId] = useState(model?.provider_id || (providers[0]?.id ?? 0));
  const [providerModel, setProviderModel] = useState(model?.provider_model || "");
  const [inputText, setInputText] = useState(model?.input_text ?? true);
  const [inputImage, setInputImage] = useState(model?.input_image ?? false);
  const [inputAudio, setInputAudio] = useState(model?.input_audio ?? false);
  const [inputVideo, setInputVideo] = useState(model?.input_video ?? false);
  const [outputText, setOutputText] = useState(model?.output_text ?? true);
  const [outputAudio, setOutputAudio] = useState(model?.output_audio ?? false);
  const [outputImage, setOutputImage] = useState(model?.output_image ?? false);
  const [functionCall, setFunctionCall] = useState(model?.function_call ?? false);
  const [reasoning, setReasoning] = useState(model?.reasoning ?? false);
  const [priority, setPriority] = useState(model?.priority ?? 0);
  const [weight, setWeight] = useState(model?.weight ?? 1);
  const [priceInput, setPriceInput] = useState(model?.price_input ?? 0);
  const [priceOutput, setPriceOutput] = useState(model?.price_output ?? 0);
  const [enabled, setEnabled] = useState(model?.enabled ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedProvider = providers.find((p) => p.id === providerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = {
        name,
        provider_id: providerId,
        provider_model: providerModel,
        input_text: inputText,
        input_image: inputImage,
        input_audio: inputAudio,
        input_video: inputVideo,
        output_text: outputText,
        output_audio: outputAudio,
        output_image: outputImage,
        function_call: functionCall,
        reasoning,
        priority,
        weight,
        price_input: priceInput,
        price_output: priceOutput,
        enabled,
      };
      if (model) {
        await updateModel(model.id, data);
      } else {
        await createModel(data);
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
      <h3 style={{ marginTop: 0 }}>{model ? t.editModelMapping : t.addModelMapping}</h3>
      {error && <div style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</div>}

      <div style={fieldStyle}>
        <label>{t.modelNameExternal}</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder={t.modelNamePlaceholder} required style={inputStyle} />
        <small style={{ color: "var(--text-muted)" }}>{t.modelNameHelp}</small>
      </div>
      <div style={fieldStyle}>
        <label>{t.provider}</label>
        <select value={providerId} onChange={(e) => setProviderId(Number(e.target.value))}
          required style={inputStyle}>
          <option value={0} disabled>{t.selectProvider}</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.protocol === "anthropic" ? "Anthropic" : "OpenAI"})
            </option>
          ))}
        </select>
        {selectedProvider && (
          <small style={{ color: "var(--text-muted)" }}>
            {t.protocol}: <strong>{selectedProvider.protocol === "anthropic" ? "Anthropic" : "OpenAI"}</strong>
          </small>
        )}
      </div>
      <div style={fieldStyle}>
        <label>{t.providerModelName}</label>
        <input value={providerModel} onChange={(e) => setProviderModel(e.target.value)}
          placeholder={t.providerModelPlaceholder} required style={inputStyle} />
        <small style={{ color: "var(--text-muted)" }}>{t.providerModelHelp}</small>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 6 }}>{t.capabilities}</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={capLabel}>{t.input}</span>
            <label><input type="checkbox" checked={inputText} onChange={(e) => setInputText(e.target.checked)} /> {t.text}</label>
            <label><input type="checkbox" checked={inputImage} onChange={(e) => setInputImage(e.target.checked)} /> {t.image}</label>
            <label><input type="checkbox" checked={inputAudio} onChange={(e) => setInputAudio(e.target.checked)} /> {t.audio}</label>
            <label><input type="checkbox" checked={inputVideo} onChange={(e) => setInputVideo(e.target.checked)} /> {t.video}</label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={capLabel}>{t.output}</span>
            <label><input type="checkbox" checked={outputText} onChange={(e) => setOutputText(e.target.checked)} /> {t.text}</label>
            <label><input type="checkbox" checked={outputAudio} onChange={(e) => setOutputAudio(e.target.checked)} /> {t.audio}</label>
            <label><input type="checkbox" checked={outputImage} onChange={(e) => setOutputImage(e.target.checked)} /> {t.image}</label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={capLabel}>{t.special}</span>
            <label><input type="checkbox" checked={functionCall} onChange={(e) => setFunctionCall(e.target.checked)} /> {t.tools}</label>
            <label><input type="checkbox" checked={reasoning} onChange={(e) => setReasoning(e.target.checked)} /> {t.reasoning}</label>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div style={{ flex: "0 0 140px" }}>
          <label>{t.priority}</label>
          <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))}
            style={inputStyle} />
          <small style={{ color: "var(--text-muted)" }}>{t.priorityHelp}</small>
        </div>
        <div style={{ flex: "0 0 140px" }}>
          <label>{t.weight}</label>
          <input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))}
            min={1} style={inputStyle} />
          <small style={{ color: "var(--text-muted)" }}>{t.weightHelp}</small>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div style={{ flex: "0 0 160px" }}>
          <label>{t.priceInput}</label>
          <input type="number" value={priceInput} onChange={(e) => setPriceInput(Number(e.target.value))}
            min={0} step="any" style={inputStyle} />
        </div>
        <div style={{ flex: "0 0 160px" }}>
          <label>{t.priceOutput}</label>
          <input type="number" value={priceOutput} onChange={(e) => setPriceOutput(Number(e.target.value))}
            min={0} step="any" style={inputStyle} />
        </div>
        <div style={{ alignSelf: "flex-end", paddingBottom: 6 }}>
          <small style={{ color: "var(--text-muted)" }}>{t.priceHelp}</small>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
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

const formStyle: React.CSSProperties = {
  background: "var(--surface)", padding: 20, borderRadius: 8, marginBottom: 20, border: "1px solid var(--border)",
};
const fieldStyle: React.CSSProperties = { marginBottom: 12 };
const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
  borderRadius: 6, fontSize: 14, marginTop: 4, boxSizing: "border-box",
  background: "var(--bg)", color: "var(--text)",
};
const capLabel: React.CSSProperties = {
  display: "inline-block", width: 60, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)",
};
const btnStyle: React.CSSProperties = {
  padding: "8px 20px", background: "var(--accent)", color: "var(--accent-text)",
  border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14,
};
const cancelBtn: React.CSSProperties = { ...btnStyle, background: "var(--text-muted)" };
