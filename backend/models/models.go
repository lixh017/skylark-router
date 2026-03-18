package models

import "time"

type APIKey struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	Name       string    `json:"name" gorm:"not null"`
	Key        string    `json:"-" gorm:"uniqueIndex;not null"`
	KeySuffix  string    `json:"key_suffix" gorm:"not null"`
	Enabled    bool      `json:"enabled" gorm:"default:true"`
	RateLimit  int       `json:"rate_limit" gorm:"default:0"`  // req/min, 0=unlimited
	QuotaTotal int64     `json:"quota_total" gorm:"default:0"` // total token budget, 0=unlimited
	QuotaUsed  int64     `json:"quota_used" gorm:"default:0"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Protocol constants
const (
	ProtocolOpenAI    = "openai"
	ProtocolAnthropic = "anthropic"
	ProtocolRealtime  = "realtime"
)

type Provider struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"uniqueIndex;not null"`
	BaseURL   string    `json:"base_url" gorm:"not null"`
	APIKey    string    `json:"api_key" gorm:"not null"`
	Protocol  string    `json:"protocol" gorm:"default:openai;not null"` // "openai" or "anthropic"
	Enabled   bool      `json:"enabled" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Model struct {
	ID            uint   `json:"id" gorm:"primaryKey"`
	Name          string `json:"name" gorm:"index;not null"`
	ProviderID    uint   `json:"provider_id" gorm:"not null"`
	ProviderModel string `json:"provider_model" gorm:"not null"`
	InputText     bool   `json:"input_text"    gorm:"default:true"`
	InputImage    bool   `json:"input_image"   gorm:"default:false"`
	InputAudio    bool   `json:"input_audio"   gorm:"default:false"`
	InputVideo    bool   `json:"input_video"   gorm:"default:false"`
	OutputText    bool   `json:"output_text"   gorm:"default:true"`
	OutputAudio   bool   `json:"output_audio"  gorm:"default:false"`
	OutputImage   bool   `json:"output_image"  gorm:"default:false"`
	FunctionCall  bool   `json:"function_call" gorm:"default:false"`
	Reasoning     bool   `json:"reasoning"     gorm:"default:false"`
	Priority      int    `json:"priority" gorm:"default:0"`
	Weight        int    `json:"weight" gorm:"default:1"`
	PriceInput    float64 `json:"price_input"  gorm:"default:0"`  // USD per 1M input tokens
	PriceOutput   float64 `json:"price_output" gorm:"default:0"`  // USD per 1M output tokens
	Enabled       bool      `json:"enabled" gorm:"default:true"`
	Provider      Provider  `json:"provider" gorm:"foreignKey:ProviderID"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type UsageLog struct {
	ID               uint      `json:"id" gorm:"primaryKey"`
	ModelName        string    `json:"model_name" gorm:"index"`
	ProviderID       uint      `json:"provider_id"`
	ProviderName     string    `json:"provider_name"`
	PromptTokens     int       `json:"prompt_tokens"`
	CompletionTokens int       `json:"completion_tokens"`
	CostUSD          float64   `json:"cost_usd" gorm:"default:0"`
	Success          bool      `json:"success"`
	ErrorMessage     string    `json:"error_message,omitempty"`
	Latency          int64     `json:"latency"` // milliseconds
	CreatedAt        time.Time `json:"created_at"`
}

type RequestLog struct {
	ID               uint      `json:"id" gorm:"primaryKey"`
	APIKeyID         uint      `json:"api_key_id" gorm:"index"`
	ModelName        string    `json:"model_name" gorm:"index"`
	ProviderName     string    `json:"provider_name"`
	RequestBody      string    `json:"request_body" gorm:"type:text"`
	ResponseBody     string    `json:"response_body" gorm:"type:text"`
	StatusCode       int       `json:"status_code"`
	PromptTokens     int       `json:"prompt_tokens"`
	CompletionTokens int       `json:"completion_tokens"`
	Latency          int64     `json:"latency"`
	Success          bool      `json:"success"`
	CreatedAt        time.Time `json:"created_at"`
}

// User role constants
const (
	RoleUser  = "user"
	RoleAdmin = "admin"
)

type User struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	Username     string    `json:"username" gorm:"uniqueIndex;not null"`
	PasswordHash string    `json:"-" gorm:"column:password_hash;not null"`
	Email        string    `json:"email" gorm:"uniqueIndex"`
	Role         string    `json:"role" gorm:"default:user"`
	Enabled      bool      `json:"enabled" gorm:"default:true"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
