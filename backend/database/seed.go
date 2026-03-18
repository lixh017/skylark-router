package database

import (
	"skylark-router/models"
	"log"
)

// Seed pre-populates providers and models on first run
func Seed() {
	var count int64
	DB.Model(&models.Provider{}).Count(&count)
	if count > 0 {
		return // already seeded
	}

	log.Println("Seeding default providers and models...")

	providers := []models.Provider{
		{Name: "siliconflow", BaseURL: "https://api.siliconflow.cn", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
		{Name: "groq", BaseURL: "https://api.groq.com/openai", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
		{Name: "together", BaseURL: "https://api.together.xyz", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
		{Name: "deepseek", BaseURL: "https://api.deepseek.com", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
		{Name: "openrouter", BaseURL: "https://openrouter.ai/api", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
		{Name: "cerebras", BaseURL: "https://api.cerebras.ai", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
		{Name: "gemini", BaseURL: "https://generativelanguage.googleapis.com/v1beta/openai", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
		{Name: "anthropic", BaseURL: "https://api.anthropic.com", APIKey: "", Protocol: models.ProtocolAnthropic, Enabled: false},
		{Name: "github-models", BaseURL: "https://models.inference.ai.azure.com", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
		{Name: "mistral", BaseURL: "https://api.mistral.ai", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
		{Name: "volcengine-ark", BaseURL: "https://ark.cn-beijing.volces.com/api/v3", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
		{Name: "dashscope", BaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
		{Name: "moonshot", BaseURL: "https://api.moonshot.cn/v1", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
		{Name: "lingyiwanwu", BaseURL: "https://api.lingyiwanwu.com/v1", APIKey: "", Protocol: models.ProtocolOpenAI, Enabled: false},
	}

	for i := range providers {
		if err := DB.Create(&providers[i]).Error; err != nil {
			log.Printf("Failed to seed provider %s: %v", providers[i].Name, err)
		}
	}

	// Helper to find provider ID by name
	pid := func(name string) uint {
		for _, p := range providers {
			if p.Name == name {
				return p.ID
			}
		}
		return 0
	}

	seedModels := []models.Model{
		// ============ Qwen 系列 ============
		{Name: "qwen-7b", ProviderID: pid("siliconflow"), ProviderModel: "Qwen/Qwen2.5-7B-Instruct", InputText: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},
		{Name: "qwen-7b", ProviderID: pid("together"), ProviderModel: "Qwen/Qwen2.5-7B-Instruct-Turbo", InputText: true, OutputText: true, FunctionCall: true, Priority: 5, Enabled: true},
		{Name: "qwen-32b", ProviderID: pid("siliconflow"), ProviderModel: "Qwen/Qwen2.5-32B-Instruct", InputText: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},
		{Name: "qwen-32b", ProviderID: pid("groq"), ProviderModel: "qwen-qwq-32b", InputText: true, OutputText: true, FunctionCall: true, Priority: 5, Enabled: true},
		{Name: "qwen-72b", ProviderID: pid("siliconflow"), ProviderModel: "Qwen/Qwen2.5-72B-Instruct", InputText: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},
		{Name: "qwen-72b", ProviderID: pid("together"), ProviderModel: "Qwen/Qwen2.5-72B-Instruct-Turbo", InputText: true, OutputText: true, FunctionCall: true, Priority: 5, Enabled: true},
		{Name: "qwen-vl", ProviderID: pid("siliconflow"), ProviderModel: "Qwen/Qwen2.5-VL-72B-Instruct", InputText: true, InputImage: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},
		{Name: "qwen-coder", ProviderID: pid("siliconflow"), ProviderModel: "Qwen/Qwen2.5-Coder-32B-Instruct", InputText: true, OutputText: true, FunctionCall: false, Priority: 10, Enabled: true},

		// ============ DeepSeek 系列 ============
		{Name: "deepseek-chat", ProviderID: pid("deepseek"), ProviderModel: "deepseek-chat", InputText: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},
		{Name: "deepseek-chat", ProviderID: pid("siliconflow"), ProviderModel: "deepseek-ai/DeepSeek-V3", InputText: true, OutputText: true, FunctionCall: true, Priority: 5, Enabled: true},
		{Name: "deepseek-reasoner", ProviderID: pid("deepseek"), ProviderModel: "deepseek-reasoner", InputText: true, OutputText: true, Reasoning: true, Priority: 10, Enabled: true},
		{Name: "deepseek-reasoner", ProviderID: pid("siliconflow"), ProviderModel: "deepseek-ai/DeepSeek-R1", InputText: true, OutputText: true, Reasoning: true, Priority: 5, Enabled: true},

		// ============ Llama 系列 ============
		{Name: "llama-8b", ProviderID: pid("groq"), ProviderModel: "llama-3.3-70b-versatile", InputText: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},
		{Name: "llama-70b", ProviderID: pid("groq"), ProviderModel: "llama-3.3-70b-versatile", InputText: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},
		{Name: "llama-70b", ProviderID: pid("together"), ProviderModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", InputText: true, OutputText: true, FunctionCall: true, Priority: 5, Enabled: true},
		{Name: "llama-70b", ProviderID: pid("cerebras"), ProviderModel: "llama-3.3-70b", InputText: true, OutputText: true, FunctionCall: true, Priority: 3, Enabled: true},
		{Name: "llama-vision", ProviderID: pid("groq"), ProviderModel: "llama-3.2-90b-vision-preview", InputText: true, InputImage: true, OutputText: true, Priority: 10, Enabled: true},
		{Name: "llama-vision", ProviderID: pid("together"), ProviderModel: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo", InputText: true, InputImage: true, OutputText: true, Priority: 5, Enabled: true},

		// ============ Gemini 系列 ============
		{Name: "gemini-flash", ProviderID: pid("gemini"), ProviderModel: "gemini-2.0-flash", InputText: true, InputImage: true, InputAudio: true, InputVideo: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},
		{Name: "gemini-pro", ProviderID: pid("gemini"), ProviderModel: "gemini-2.5-pro-preview-06-05", InputText: true, InputImage: true, InputAudio: true, InputVideo: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},

		// ============ Claude 系列 ============
		{Name: "claude-sonnet", ProviderID: pid("anthropic"), ProviderModel: "claude-sonnet-4-6", InputText: true, InputImage: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},
		{Name: "claude-haiku", ProviderID: pid("anthropic"), ProviderModel: "claude-haiku-4-5-20251001", InputText: true, InputImage: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},

		// ============ Mistral 系列 ============
		{Name: "mistral-small", ProviderID: pid("mistral"), ProviderModel: "mistral-small-latest", InputText: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},
		{Name: "mistral-large", ProviderID: pid("mistral"), ProviderModel: "mistral-large-latest", InputText: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},

		// ============ GitHub Models (免费) ============
		{Name: "gpt-4o-mini", ProviderID: pid("github-models"), ProviderModel: "gpt-4o-mini", InputText: true, InputImage: true, OutputText: true, FunctionCall: true, Priority: 10, Enabled: true},

		// ============ OpenRouter 免费模型 ============
		{Name: "phi-4", ProviderID: pid("openrouter"), ProviderModel: "microsoft/phi-4", InputText: true, OutputText: true, Priority: 10, Enabled: true},
	}

	for i := range seedModels {
		if seedModels[i].ProviderID == 0 {
			continue
		}
		if err := DB.Create(&seedModels[i]).Error; err != nil {
			log.Printf("Failed to seed model %s: %v", seedModels[i].Name, err)
		}
	}

	// Disable all providers with empty API keys (GORM default:true overrides false)
	DB.Model(&models.Provider{}).Where("api_key = ?", "").Update("enabled", false)

	log.Printf("Seeded %d providers and %d models", len(providers), len(seedModels))
}
