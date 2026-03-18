package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"skylark-router/database"
	"skylark-router/models"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func ListProviders(c *gin.Context) {
	var providers []models.Provider
	database.DB.Order("created_at desc").Find(&providers)
	c.JSON(http.StatusOK, providers)
}

func GetProvider(c *gin.Context) {
	var provider models.Provider
	if err := database.DB.First(&provider, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
		return
	}
	c.JSON(http.StatusOK, provider)
}

func CreateProvider(c *gin.Context) {
	var provider models.Provider
	if err := c.ShouldBindJSON(&provider); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	provider.Enabled = true
	if provider.Protocol == "" {
		provider.Protocol = models.ProtocolOpenAI
	}
	if err := database.DB.Create(&provider).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, provider)
}

func UpdateProvider(c *gin.Context) {
	var provider models.Provider
	if err := database.DB.First(&provider, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
		return
	}

	var input models.Provider
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Model(&provider).Updates(map[string]interface{}{
		"name":     input.Name,
		"base_url": input.BaseURL,
		"api_key":  input.APIKey,
		"protocol": input.Protocol,
		"enabled":  input.Enabled,
	})
	c.JSON(http.StatusOK, provider)
}

func DeleteProvider(c *gin.Context) {
	if err := database.DB.Delete(&models.Provider{}, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Also delete associated models
	database.DB.Where("provider_id = ?", c.Param("id")).Delete(&models.Model{})
	c.JSON(http.StatusOK, gin.H{"message": "Provider deleted"})
}

// TestProvider sends a minimal chat request directly to the provider and reports latency/status.
// Optional body: {"model_name": "gpt-4o"}  — if omitted, uses first model found for the provider.
func TestProvider(c *gin.Context) {
	var provider models.Provider
	if err := database.DB.First(&provider, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
		return
	}

	// Parse optional model_name from body
	var input struct {
		ModelName string `json:"model_name"`
	}
	_ = c.ShouldBindJSON(&input)

	// Find a model to test with
	var m models.Model
	q := database.DB.Where("provider_id = ?", provider.ID)
	if input.ModelName != "" {
		q = q.Where("name = ?", input.ModelName)
	}
	if err := q.First(&m).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No model found for this provider. Add a model mapping first."})
		return
	}

	// Build a minimal request
	type msg struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	base := strings.TrimRight(provider.BaseURL, "/")
	start := time.Now()
	var reqBody []byte
	var url string

	if provider.Protocol == models.ProtocolAnthropic {
		url = base + "/v1/messages"
		body := map[string]interface{}{
			"model":      m.ProviderModel,
			"max_tokens": 8,
			"messages":   []msg{{Role: "user", Content: "Reply with the single word: ok"}},
		}
		reqBody, _ = json.Marshal(body)
	} else {
		url = base + "/chat/completions" // base already includes version path (e.g. /v1)
		body := map[string]interface{}{
			"model":      m.ProviderModel,
			"max_tokens": 8,
			"messages":   []msg{{Role: "user", Content: "Reply with the single word: ok"}},
		}
		reqBody, _ = json.Marshal(body)
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(reqBody))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error(), "latency_ms": 0})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if provider.Protocol == models.ProtocolAnthropic {
		httpReq.Header.Set("x-api-key", provider.APIKey)
		httpReq.Header.Set("anthropic-version", "2023-06-01")
	} else {
		httpReq.Header.Set("Authorization", "Bearer "+provider.APIKey)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	latencyMs := time.Since(start).Milliseconds()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"ok": false, "latency_ms": latencyMs,
			"model_used": fmt.Sprintf("%s → %s", m.Name, m.ProviderModel),
			"error":      err.Error(),
		})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		// Try to extract error message from body
		var errBody map[string]interface{}
		errMsg := fmt.Sprintf("HTTP %d", resp.StatusCode)
		if json.Unmarshal(respBody, &errBody) == nil {
			if e, ok := errBody["error"]; ok {
				errMsg = fmt.Sprintf("HTTP %d: %v", resp.StatusCode, e)
			}
		}
		c.JSON(http.StatusOK, gin.H{
			"ok": false, "latency_ms": latencyMs,
			"model_used": fmt.Sprintf("%s → %s", m.Name, m.ProviderModel),
			"error":      errMsg,
		})
		return
	}

	// Extract first content text for display
	preview := ""
	if provider.Protocol == models.ProtocolAnthropic {
		var ar struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		}
		if json.Unmarshal(respBody, &ar) == nil && len(ar.Content) > 0 {
			preview = ar.Content[0].Text
		}
	} else {
		var or struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}
		if json.Unmarshal(respBody, &or) == nil && len(or.Choices) > 0 {
			preview = or.Choices[0].Message.Content
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":         true,
		"latency_ms": latencyMs,
		"model_used": fmt.Sprintf("%s → %s", m.Name, m.ProviderModel),
		"preview":    preview,
	})
}
