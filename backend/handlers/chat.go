package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"skylark-router/config"
	"skylark-router/database"
	"skylark-router/models"
	"skylark-router/proxy"
	"skylark-router/router"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// parseRetryAfter parses the Retry-After value from a ProxyResult.
// Returns defaultSecs if not present or unparseable.
func parseRetryAfter(result *proxy.ProxyResult, defaultSecs int) time.Duration {
	if result.RetryAfter == "" {
		return time.Duration(defaultSecs) * time.Second
	}
	if secs, err := strconv.Atoi(result.RetryAfter); err == nil {
		if secs > 30 {
			secs = 30
		}
		return time.Duration(secs) * time.Second
	}
	return time.Duration(defaultSecs) * time.Second
}

// selectRoutes finds routes with capability filtering
func selectRoutes(c *gin.Context, modelName string, reqs *router.Requirements) ([]router.ModelRoute, bool) {
	selected, fallbacks, err := router.SelectRoute(modelName, reqs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"message": "Route selection error: " + err.Error(), "type": "server_error"},
		})
		return nil, false
	}
	if selected == nil {
		msg := "No available provider for model: " + modelName
		if reqs != nil {
			caps := ""
			if reqs.NeedsInputImage {
				caps += " input_image"
			}
			if reqs.NeedsInputAudio {
				caps += " input_audio"
			}
			if reqs.NeedsInputVideo {
				caps += " input_video"
			}
			if reqs.NeedsOutputAudio {
				caps += " output_audio"
			}
			if reqs.NeedsOutputImage {
				caps += " output_image"
			}
			if reqs.NeedsFunctionCall {
				caps += " function_call"
			}
			if reqs.NeedsReasoning {
				caps += " reasoning"
			}
			if caps != "" {
				msg += " (with required capabilities:" + caps + ")"
			}
		}
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"message": msg, "type": "model_not_found"},
		})
		return nil, false
	}
	return append([]router.ModelRoute{*selected}, fallbacks...), true
}

// ===================== OpenAI /v1/chat/completions =====================

func ChatCompletions(c *gin.Context) {
	var req proxy.OpenAIChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"message": "Invalid request: " + err.Error(), "type": "invalid_request_error"},
		})
		return
	}
	// Fall back to configured default model
	if req.Model == "" {
		req.Model = config.C.DefaultModel
	}
	if req.Model == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"message": "model is required (or set default_model in config)", "type": "invalid_request_error"},
		})
		return
	}

	// Serialize request body for logging
	reqBody := ""
	if config.C.LogRequests {
		if b, err := json.Marshal(req); err == nil {
			reqBody = string(b)
		}
	}

	// Detect capabilities needed
	reqs := proxy.DetectOpenAIRequirements(&req)

	// Check for reasoning header
	if c.GetHeader("X-LLM-Require-Reasoning") == "true" {
		reqs.NeedsReasoning = true
	}

	var reqsPtr *router.Requirements
	if reqs.NeedsInputImage || reqs.NeedsInputAudio || reqs.NeedsInputVideo ||
		reqs.NeedsOutputAudio || reqs.NeedsOutputImage ||
		reqs.NeedsFunctionCall || reqs.NeedsReasoning {
		reqsPtr = &reqs
		log.Printf("[router] Detected capabilities needed: input_image=%v, input_audio=%v, input_video=%v, output_audio=%v, output_image=%v, function_call=%v, reasoning=%v",
			reqs.NeedsInputImage, reqs.NeedsInputAudio, reqs.NeedsInputVideo,
			reqs.NeedsOutputAudio, reqs.NeedsOutputImage,
			reqs.NeedsFunctionCall, reqs.NeedsReasoning)
	}

	routes, ok := selectRoutes(c, req.Model, reqsPtr)
	if !ok {
		return
	}
	// If wildcard was used, resolve to the actual selected model name for logging
	if req.Model == "auto" {
		req.Model = routes[0].Model.Name
	}

	for i := 0; i < len(routes); i++ {
		route := routes[i]
		retryCount := 0

		log.Printf("[router] OpenAI → provider %s (%s) for model %s (%d/%d)",
			route.Provider.Name, route.Provider.Protocol, req.Model, i+1, len(routes))

	retryOpenAI:
		if req.Stream {
			result := proxy.ForwardOpenAIStream(&route, req, c.Writer)
			logUsage(c, req.Model, &route, result, reqBody)
			if result.Error != nil && result.StatusCode == 0 {
				log.Printf("[router] Provider %s failed: %v, trying next...", route.Provider.Name, result.Error)
				continue
			}
			if result.StatusCode == 429 && retryCount < 1 {
				wait := parseRetryAfter(result, 2)
				log.Printf("[router] Provider %s returned 429, retrying after %v...", route.Provider.Name, wait)
				time.Sleep(wait)
				retryCount++
				goto retryOpenAI
			}
			return
		}

		result := proxy.ForwardOpenAI(&route, req)
		logUsage(c, req.Model, &route, result, reqBody)
		if result.StatusCode == 429 && retryCount < 1 {
			wait := parseRetryAfter(result, 2)
			log.Printf("[router] Provider %s returned 429, retrying after %v...", route.Provider.Name, wait)
			time.Sleep(wait)
			retryCount++
			goto retryOpenAI
		}
		if result.Error != nil {
			log.Printf("[router] Provider %s failed: %v, trying next...", route.Provider.Name, result.Error)
			continue
		}
		c.Data(result.StatusCode, "application/json", result.Body)
		return
	}

	c.JSON(http.StatusBadGateway, gin.H{
		"error": gin.H{"message": "All providers failed for model: " + req.Model, "type": "server_error"},
	})
}

// ===================== Anthropic /v1/messages =====================

func AnthropicMessages(c *gin.Context) {
	var req proxy.AnthropicRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"type":  "error",
			"error": gin.H{"type": "invalid_request_error", "message": "Invalid request: " + err.Error()},
		})
		return
	}
	if req.Model == "" {
		req.Model = config.C.DefaultModel
	}
	if req.Model == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"type":  "error",
			"error": gin.H{"type": "invalid_request_error", "message": "model is required (or set default_model in config)"},
		})
		return
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = 4096
	}

	// Serialize request body for logging
	reqBody := ""
	if config.C.LogRequests {
		if b, err := json.Marshal(req); err == nil {
			reqBody = string(b)
		}
	}

	// Detect capabilities needed
	reqs := proxy.DetectAnthropicRequirements(&req)

	// Check for reasoning header
	if c.GetHeader("X-LLM-Require-Reasoning") == "true" {
		reqs.NeedsReasoning = true
	}

	var reqsPtr *router.Requirements
	if reqs.NeedsInputImage || reqs.NeedsInputAudio || reqs.NeedsInputVideo ||
		reqs.NeedsOutputAudio || reqs.NeedsOutputImage ||
		reqs.NeedsFunctionCall || reqs.NeedsReasoning {
		reqsPtr = &reqs
		log.Printf("[router] Detected capabilities needed: input_image=%v, input_audio=%v, input_video=%v, output_audio=%v, output_image=%v, function_call=%v, reasoning=%v",
			reqs.NeedsInputImage, reqs.NeedsInputAudio, reqs.NeedsInputVideo,
			reqs.NeedsOutputAudio, reqs.NeedsOutputImage,
			reqs.NeedsFunctionCall, reqs.NeedsReasoning)
	}

	routes, ok := selectRoutes(c, req.Model, reqsPtr)
	if !ok {
		return
	}
	if req.Model == "auto" {
		req.Model = routes[0].Model.Name
	}

	for i := 0; i < len(routes); i++ {
		route := routes[i]
		retryCount := 0

		log.Printf("[router] Anthropic → provider %s (%s) for model %s (%d/%d)",
			route.Provider.Name, route.Provider.Protocol, req.Model, i+1, len(routes))

	retryAnthropic:
		if req.Stream {
			result := proxy.ForwardAnthropicStream(&route, req, c.Writer)
			logUsage(c, req.Model, &route, result, reqBody)
			if result.Error != nil && result.StatusCode == 0 {
				log.Printf("[router] Provider %s failed: %v, trying next...", route.Provider.Name, result.Error)
				continue
			}
			if result.StatusCode == 429 && retryCount < 1 {
				wait := parseRetryAfter(result, 2)
				log.Printf("[router] Provider %s returned 429, retrying after %v...", route.Provider.Name, wait)
				time.Sleep(wait)
				retryCount++
				goto retryAnthropic
			}
			return
		}

		result := proxy.ForwardAnthropic(&route, req)
		logUsage(c, req.Model, &route, result, reqBody)
		if result.StatusCode == 429 && retryCount < 1 {
			wait := parseRetryAfter(result, 2)
			log.Printf("[router] Provider %s returned 429, retrying after %v...", route.Provider.Name, wait)
			time.Sleep(wait)
			retryCount++
			goto retryAnthropic
		}
		if result.Error != nil {
			log.Printf("[router] Provider %s failed: %v, trying next...", route.Provider.Name, result.Error)
			continue
		}
		c.Data(result.StatusCode, "application/json", result.Body)
		return
	}

	c.JSON(http.StatusBadGateway, gin.H{
		"type":  "error",
		"error": gin.H{"type": "api_error", "message": "All providers failed for model: " + req.Model},
	})
}

// ===================== Shared =====================

func logUsage(c *gin.Context, modelName string, route *router.ModelRoute, result *proxy.ProxyResult, requestBody string) {
	errMsg := ""
	if result.Error != nil {
		errMsg = result.Error.Error()
	}

	usage := models.UsageLog{
		ModelName:        modelName,
		ProviderID:       route.Provider.ID,
		ProviderName:     route.Provider.Name,
		PromptTokens:     result.PromptTokens,
		CompletionTokens: result.CompletionTokens,
		CostUSD:          float64(result.PromptTokens)*route.Model.PriceInput/1_000_000 + float64(result.CompletionTokens)*route.Model.PriceOutput/1_000_000,
		Success:          result.Error == nil,
		ErrorMessage:     errMsg,
		Latency:          result.Latency.Milliseconds(),
	}

	if err := database.DB.Create(&usage).Error; err != nil {
		log.Printf("[usage] Failed to log usage: %v", err)
	}

	// Update quota if api_key_id is set
	if keyID, exists := c.Get("api_key_id"); exists && result.Error == nil {
		totalTokens := result.PromptTokens + result.CompletionTokens
		if totalTokens > 0 {
			database.DB.Model(&models.APIKey{}).Where("id = ?", keyID).
				Update("quota_used", gorm.Expr("quota_used + ?", totalTokens))
		}
	}

	// Write request log if enabled
	if config.C.LogRequests {
		respBody := string(result.Body)
		if len(result.Body) == 0 {
			respBody = "[streaming]"
		}

		apiKeyID := uint(0)
		if keyID, exists := c.Get("api_key_id"); exists {
			apiKeyID = keyID.(uint)
		}

		reqLog := models.RequestLog{
			APIKeyID:         apiKeyID,
			ModelName:        modelName,
			ProviderName:     route.Provider.Name,
			RequestBody:      requestBody,
			ResponseBody:     respBody,
			StatusCode:       result.StatusCode,
			PromptTokens:     result.PromptTokens,
			CompletionTokens: result.CompletionTokens,
			Latency:          result.Latency.Milliseconds(),
			Success:          result.Error == nil,
		}
		if err := database.DB.Create(&reqLog).Error; err != nil {
			log.Printf("[requestlog] Failed to log request: %v", err)
		}
	}
}
