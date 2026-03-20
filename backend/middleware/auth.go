package middleware

import (
	"net/http"
	"strings"

	"skylark-router/config"
	"skylark-router/database"
	"skylark-router/models"

	"github.com/gin-gonic/gin"
)

// ProxyAuth validates API keys for LLM proxy endpoints.
// If no APIKey records exist in the DB, all requests are allowed (first-run mode).
func ProxyAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		var count int64
		database.DB.Model(&models.APIKey{}).Count(&count)
		if count == 0 {
			// No keys configured — allow all (first-run / no-auth mode)
			c.Next()
			return
		}

		key := extractKey(c)
		if key == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{"message": "Missing API key", "type": "invalid_request_error"},
			})
			return
		}

		// Admin token also grants proxy access (e.g. built-in Chat UI)
		if adminToken := config.C.AuthToken; adminToken != "" && key == adminToken {
			c.Next()
			return
		}

		var apiKey models.APIKey
		if err := database.DB.Where("key = ? AND enabled = ?", key, true).First(&apiKey).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{"message": "Invalid or disabled API key", "type": "invalid_request_error"},
			})
			return
		}

		// Rate limit check
		if apiKey.RateLimit > 0 && !Allow(apiKey.ID, apiKey.RateLimit) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": gin.H{"message": "Rate limit exceeded", "type": "rate_limit_error"},
			})
			return
		}

		// Quota check
		if apiKey.QuotaTotal > 0 && apiKey.QuotaUsed >= apiKey.QuotaTotal {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": gin.H{"message": "Token quota exceeded", "type": "quota_exceeded"},
			})
			return
		}

		c.Set("api_key_id", apiKey.ID)
		c.Next()
	}
}

// AdminAuth validates the static admin token for management endpoints.
// If AUTH_TOKEN is not set, all requests are allowed (backward compatible).
func AdminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := config.C.AuthToken
		if token == "" {
			c.Next()
			return
		}

		auth := c.GetHeader("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") || strings.TrimPrefix(auth, "Bearer ") != token {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Unauthorized",
			})
			return
		}

		c.Next()
	}
}

func extractKey(c *gin.Context) string {
	// Authorization: Bearer sk-xxx
	auth := c.GetHeader("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	// x-api-key: sk-xxx
	if key := c.GetHeader("x-api-key"); key != "" {
		return key
	}
	return ""
}
