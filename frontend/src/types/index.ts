export type Protocol = "openai" | "anthropic" | "realtime";

export interface Provider {
  id: number;
  name: string;
  base_url: string;
  api_key: string;
  protocol: Protocol;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Model {
  id: number;
  name: string;
  provider_id: number;
  provider_model: string;
  input_text: boolean;
  input_image: boolean;
  input_audio: boolean;
  input_video: boolean;
  output_text: boolean;
  output_audio: boolean;
  output_image: boolean;
  function_call: boolean;
  reasoning: boolean;
  priority: number;
  weight: number;
  price_input: number;
  price_output: number;
  enabled: boolean;
  provider: Provider;
  created_at: string;
  updated_at: string;
}

export interface UsageLog {
  id: number;
  model_name: string;
  provider_id: number;
  provider_name: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  success: boolean;
  error_message: string;
  latency: number;
  created_at: string;
}

export interface Stats {
  total_requests: number;
  success_requests: number;
  failed_requests: number;
  avg_latency: number;
  total_tokens: number;
  total_cost_usd: number;
  provider_stats: ProviderStat[] | null;
  recent_requests: UsageLog[] | null;
}

export interface ProviderStat {
  provider_name: string;
  request_count: number;
  success_count: number;
  avg_latency: number;
  total_tokens: number;
  cost_usd: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface APIKey {
  id: number;
  name: string;
  key_suffix: string;
  key?: string;
  enabled: boolean;
  rate_limit: number;
  quota_total: number;
  quota_used: number;
  created_at: string;
  updated_at: string;
}

export interface RequestLog {
  id: number;
  api_key_id: number;
  model_name: string;
  provider_name: string;
  request_body: string;
  response_body: string;
  status_code: number;
  prompt_tokens: number;
  completion_tokens: number;
  latency: number;
  success: boolean;
  created_at: string;
}

export interface RequestLogListResponse {
  data: RequestLog[];
  total: number;
  page: number;
  limit: number;
}
