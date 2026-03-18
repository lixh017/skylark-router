import type { Provider, Model, Stats, ChatRequest, Protocol, APIKey, RequestLog, RequestLogListResponse } from "../types";

// ---------------------------------------------------------------------------
// Backend origin resolution
// In plain browser mode (web server), all paths are relative (e.g. "/api/…").
// In Tauri desktop mode, the WebView uses a custom scheme so relative paths
// don't route to the Go sidecar. We resolve the origin once and cache it.
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    // Set by Tauri internals when running inside the desktop shell.
    __TAURI_INTERNALS__?: unknown;
  }
}

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

let _backendOrigin: string | null = null;

async function getBackendOrigin(): Promise<string> {
  if (!isTauri()) return ""; // relative URLs work fine in the browser
  if (_backendOrigin) return _backendOrigin;
  const { invoke } = await import("@tauri-apps/api/core");
  const port = await invoke<number>("get_backend_port");
  _backendOrigin = `http://127.0.0.1:${port}`;
  return _backendOrigin;
}

const API_BASE = "/api";

function getAdminToken(): string | null {
  return localStorage.getItem("admin_token");
}

export function setAdminToken(token: string) {
  localStorage.setItem("admin_token", token);
}

export function clearAdminToken() {
  localStorage.removeItem("admin_token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAdminToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const origin = await getBackendOrigin();
  const res = await fetch(`${origin}${API_BASE}${path}`, { headers, ...options });
  if (!res.ok) {
    if (res.status === 401) {
      const err = new Error("Unauthorized");
      (err as Error & { status: number }).status = 401;
      throw err;
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error?.message || err.error || "Request failed");
  }
  return res.json();
}

// Providers
export const listProviders = () => request<Provider[]>("/providers");
export const createProvider = (data: Partial<Provider>) =>
  request<Provider>("/providers", { method: "POST", body: JSON.stringify(data) });
export const updateProvider = (id: number, data: Partial<Provider>) =>
  request<Provider>(`/providers/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteProvider = (id: number) =>
  request<void>(`/providers/${id}`, { method: "DELETE" });
export const testProvider = (id: number, modelName?: string) =>
  request<{ ok: boolean; latency_ms: number; model_used: string; preview?: string; error?: string }>(
    `/providers/${id}/test`,
    { method: "POST", body: JSON.stringify({ model_name: modelName ?? "" }) }
  );

// Models
export const listModels = () => request<Model[]>("/models");
export const createModel = (data: Partial<Model>) =>
  request<Model>("/models", { method: "POST", body: JSON.stringify(data) });
export const updateModel = (id: number, data: Partial<Model>) =>
  request<Model>(`/models/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteModel = (id: number) =>
  request<void>(`/models/${id}`, { method: "DELETE" });

// API Keys
export const listAPIKeys = () => request<APIKey[]>("/keys");
export const createAPIKey = (name: string) =>
  request<APIKey>("/keys", { method: "POST", body: JSON.stringify({ name }) });
export const updateAPIKey = (id: number, data: Partial<APIKey>) =>
  request<APIKey>(`/keys/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteAPIKey = (id: number) =>
  request<void>(`/keys/${id}`, { method: "DELETE" });
export const resetAPIKeyQuota = (id: number) =>
  request<void>(`/keys/${id}/reset-quota`, { method: "POST" });

// Request Logs
export const listRequestLogs = (params?: { model?: string; since?: string; page?: number; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.model) query.set("model", params.model);
  if (params?.since) query.set("since", params.since);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request<RequestLogListResponse>(`/request-logs${qs ? `?${qs}` : ""}`);
};
export const getRequestLog = (id: number) => request<RequestLog>(`/request-logs/${id}`);
export const deleteRequestLogs = (before: string) =>
  request<{ deleted: number }>(`/request-logs?before=${encodeURIComponent(before)}`, { method: "DELETE" });

// Stats
export const getStats = (since?: string) => {
  const query = since ? `?since=${since}` : "";
  return request<Stats>(`/stats${query}`);
};

export interface TimeseriesPoint {
  ts: string;
  requests: number;
  errors: number;
  avg_latency: number;
  tokens: number;
  cost_usd: number;
}

export const getTimeseries = (since?: string, interval?: string) => {
  const params = new URLSearchParams();
  if (since) params.set("since", since);
  if (interval) params.set("interval", interval);
  const q = params.toString() ? `?${params.toString()}` : "";
  return request<TimeseriesPoint[]>(`/stats/timeseries${q}`);
};

// Chat - OpenAI format streaming
export async function* streamChatOpenAI(req: ChatRequest): AsyncGenerator<string> {
  const origin = await getBackendOrigin();
  const res = await fetch(`${origin}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, stream: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || "Chat request failed");
  }
  yield* readOpenAISSE(res);
}

// Chat - Anthropic format streaming
export async function* streamChatAnthropic(req: ChatRequest): AsyncGenerator<string> {
  const messages = req.messages.filter((m) => m.role !== "system");
  const system = req.messages.find((m) => m.role === "system")?.content;

  const body: Record<string, unknown> = {
    model: req.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: req.max_tokens || 4096,
    stream: true,
  };
  if (system) body.system = system;
  if (req.temperature !== undefined) body.temperature = req.temperature;

  const origin = await getBackendOrigin();
  const res = await fetch(`${origin}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || "Chat request failed");
  }
  yield* readAnthropicSSE(res);
}

async function* readOpenAISSE(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch { /* skip */ }
      }
    }
  }
}

async function* readAnthropicSSE(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            yield parsed.delta.text;
          }
        } catch { /* skip */ }
      }
    }
  }
}

// Unified stream function that picks protocol
export async function* streamChat(
  req: ChatRequest,
  protocol: Protocol = "openai"
): AsyncGenerator<string> {
  if (protocol === "anthropic") {
    yield* streamChatAnthropic(req);
  } else {
    yield* streamChatOpenAI(req);
  }
}

export interface VersionInfo {
  version: string;
  git_commit: string;
  build_time: string;
}

export async function getVersion(): Promise<VersionInfo> {
  const origin = await getBackendOrigin();
  const res = await fetch(`${origin}/api/version`);
  return res.json();
}

// ---------------------------------------------------------------------------
// App Config
// ---------------------------------------------------------------------------
export interface AppConfig {
  host: string;
  port: string;
  db_path: string;
  auth_token: string;
  log_requests: boolean;
  default_model: string;
}

export interface ConfigUpdateRequest {
  host?: string;
  port?: string;
  auth_token?: string;
  log_requests?: boolean;
  default_model?: string;
}

export interface ConfigUpdateResponse {
  restart_required: boolean;
}

export const getConfig = () => request<AppConfig>("/config");

export const updateConfig = (data: ConfigUpdateRequest) =>
  request<ConfigUpdateResponse>("/config", { method: "PUT", body: JSON.stringify(data) });

export async function restartSidecar(): Promise<number> {
  const { invoke } = await import("@tauri-apps/api/core");
  const port = await invoke<number>("restart_sidecar");
  // Update cached backend origin with the new port
  _backendOrigin = `http://127.0.0.1:${port}`;
  return port;
}

export function resetBackendOrigin() {
  _backendOrigin = null;
}
