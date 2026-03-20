package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"skylark-router/database"
	"skylark-router/models"

	"github.com/gin-gonic/gin"
)

func generateRandomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

// GET /api/keys/:id/reveal — return the full key value
func RevealAPIKey(c *gin.Context) {
	id := c.Param("id")
	var key models.APIKey
	if err := database.DB.First(&key, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Key not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"key": key.Key})
}

// GET /api/keys
func ListAPIKeys(c *gin.Context) {
	var keys []models.APIKey
	if err := database.DB.Find(&keys).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, keys)
}

// POST /api/keys
func CreateAPIKey(c *gin.Context) {
	var input struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rawKey := "sk-" + generateRandomHex(32)
	suffix := "sk-..." + rawKey[len(rawKey)-4:]

	key := models.APIKey{
		Name:      input.Name,
		Key:       rawKey,
		KeySuffix: suffix,
		Enabled:   true,
	}
	if err := database.DB.Create(&key).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return a response that includes the full key (only this once)
	type createResponse struct {
		models.APIKey
		Key string `json:"key"`
	}
	c.JSON(http.StatusCreated, createResponse{APIKey: key, Key: rawKey})
}

// PUT /api/keys/:id
func UpdateAPIKey(c *gin.Context) {
	id := c.Param("id")
	var key models.APIKey
	if err := database.DB.First(&key, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Key not found"})
		return
	}

	var input struct {
		Name       *string `json:"name"`
		Enabled    *bool   `json:"enabled"`
		RateLimit  *int    `json:"rate_limit"`
		QuotaTotal *int64  `json:"quota_total"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Name != nil {
		key.Name = *input.Name
	}
	if input.Enabled != nil {
		key.Enabled = *input.Enabled
	}
	if input.RateLimit != nil {
		key.RateLimit = *input.RateLimit
	}
	if input.QuotaTotal != nil {
		key.QuotaTotal = *input.QuotaTotal
	}

	if err := database.DB.Save(&key).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, key)
}

// POST /api/keys/:id/reset-quota
func ResetAPIKeyQuota(c *gin.Context) {
	id := c.Param("id")
	result := database.DB.Model(&models.APIKey{}).Where("id = ?", id).Update("quota_used", 0)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Key not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Quota reset"})
}

// DELETE /api/keys/:id
func DeleteAPIKey(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.APIKey{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
