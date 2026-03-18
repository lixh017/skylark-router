package handlers

import (
	"net/http"

	"skylark-router/config"

	"github.com/gin-gonic/gin"
)

type configResponse struct {
	Host         string `json:"host"`
	Port         string `json:"port"`
	DBPath       string `json:"db_path"`
	AuthToken    string `json:"auth_token"`
	LogRequests  bool   `json:"log_requests"`
	DefaultModel string `json:"default_model"`
}

// maskToken returns "****<last4>" if len>4, otherwise all stars.
func maskToken(t string) string {
	if t == "" {
		return ""
	}
	if len(t) <= 4 {
		return "****"
	}
	return "****" + t[len(t)-4:]
}

// GetConfig returns the current running configuration with auth_token masked.
func GetConfig(c *gin.Context) {
	config.Mu.RLock()
	cfg := config.C
	config.Mu.RUnlock()

	c.JSON(http.StatusOK, configResponse{
		Host:         cfg.Host,
		Port:         cfg.Port,
		DBPath:       cfg.DBPath,
		AuthToken:    maskToken(cfg.AuthToken),
		LogRequests:  cfg.LogRequests,
		DefaultModel: cfg.DefaultModel,
	})
}

type configUpdateRequest struct {
	Host         *string `json:"host"`
	Port         *string `json:"port"`
	AuthToken    *string `json:"auth_token"`
	LogRequests  *bool   `json:"log_requests"`
	DefaultModel *string `json:"default_model"`
}

type configUpdateResponse struct {
	RestartRequired bool `json:"restart_required"`
}

// UpdateConfig applies a partial update to the config. Hot-reloadable fields
// (auth_token, log_requests, default_model) take effect immediately. Changes
// to host or port require a process restart and the response indicates so.
func UpdateConfig(c *gin.Context) {
	var req configUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	config.Mu.Lock()
	defer config.Mu.Unlock()

	cfg := config.C
	restartRequired := false

	// Host
	if req.Host != nil && *req.Host != cfg.Host {
		cfg.Host = *req.Host
		restartRequired = true
	}

	// Port
	if req.Port != nil && *req.Port != cfg.Port {
		cfg.Port = *req.Port
		restartRequired = true
	}

	// Auth token: nil=no change, ""=clear, non-empty=set
	if req.AuthToken != nil {
		cfg.AuthToken = *req.AuthToken
	}

	// Log requests
	if req.LogRequests != nil {
		cfg.LogRequests = *req.LogRequests
	}

	// Default model
	if req.DefaultModel != nil {
		cfg.DefaultModel = *req.DefaultModel
	}

	// Persist to disk
	if err := config.Save(cfg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save config: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, configUpdateResponse{RestartRequired: restartRequired})
}
