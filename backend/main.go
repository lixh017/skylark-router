package main

import (
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"skylark-router/config"
	"skylark-router/database"
	"skylark-router/handlers"
	"skylark-router/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}

func main() {
	cfg := config.Load()
	database.Init()
	database.Seed()

	r := gin.Default()

	// CORS: Tauri desktop WebView uses tauri:// scheme which gin-contrib/cors
	// does not accept as a valid http/https origin. Since the server is bound
	// to 127.0.0.1 only in Tauri mode, allow all origins — local-only binding
	// already provides the necessary isolation.
	if os.Getenv("TAURI_APP") == "1" {
		r.Use(cors.New(cors.Config{
			AllowAllOrigins:  true,
			AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "x-api-key", "anthropic-version"},
			AllowCredentials: false,
		}))
	} else {
		r.Use(cors.New(cors.Config{
			AllowOrigins:     []string{"http://localhost:5173", "http://localhost:5174"},
			AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "x-api-key", "anthropic-version"},
			AllowCredentials: true,
		}))
	}

	// OpenAI-compatible API — APIKey auth
	r.POST("/v1/chat/completions", middleware.ProxyAuth(), handlers.ChatCompletions)
	r.GET("/v1/models", middleware.ProxyAuth(), handlers.ListAvailableModels)

	// Anthropic-compatible API — APIKey auth
	r.POST("/v1/messages", middleware.ProxyAuth(), handlers.AnthropicMessages)

	// Public endpoints
	r.GET("/api/version", handlers.GetVersion)

	// User authentication endpoints (public)
	r.POST("/api/users/register", handlers.Register)
	r.POST("/api/users/login", handlers.Login)

	// User endpoints (require authentication)
	userGroup := r.Group("/api/users", handlers.AuthMiddleware())
	{
		userGroup.GET("/me", handlers.GetMe)
		userGroup.PUT("/me", handlers.UpdateMe)
	}

	// Admin user management (require admin)
	adminUserGroup := r.Group("/api/users", handlers.AuthMiddleware(), handlers.AdminMiddleware())
	{
		adminUserGroup.GET("", handlers.ListUsers)
		adminUserGroup.DELETE("/:id", handlers.DeleteUser)
	}

	// Admin API — AdminAuth
	api := r.Group("/api", middleware.AdminAuth())
	{
		// Providers
		api.GET("/providers", handlers.ListProviders)
		api.GET("/providers/:id", handlers.GetProvider)
		api.POST("/providers", handlers.CreateProvider)
		api.PUT("/providers/:id", handlers.UpdateProvider)
		api.DELETE("/providers/:id", handlers.DeleteProvider)
		api.POST("/providers/:id/test", handlers.TestProvider)

		// Models
		api.GET("/models", handlers.ListModels)
		api.GET("/models/:id", handlers.GetModel)
		api.POST("/models", handlers.CreateModel)
		api.PUT("/models/:id", handlers.UpdateModel)
		api.DELETE("/models/:id", handlers.DeleteModel)

		// API Keys
		api.GET("/keys", handlers.ListAPIKeys)
		api.POST("/keys", handlers.CreateAPIKey)
		api.GET("/keys/:id/reveal", handlers.RevealAPIKey)
		api.PUT("/keys/:id", handlers.UpdateAPIKey)
		api.DELETE("/keys/:id", handlers.DeleteAPIKey)
		api.POST("/keys/:id/reset-quota", handlers.ResetAPIKeyQuota)

		// Request Logs
		api.GET("/request-logs", handlers.ListRequestLogs)
		api.GET("/request-logs/:id", handlers.GetRequestLog)
		api.DELETE("/request-logs", handlers.DeleteRequestLogs)

		// Stats
		api.GET("/stats", handlers.GetStats)
		api.GET("/stats/timeseries", handlers.GetTimeseries)

		// Config
		api.GET("/config", handlers.GetConfig)
		api.PUT("/config", handlers.UpdateConfig)

		// Web search proxy
		api.GET("/search", handlers.Search)
	}

	// Serve embedded frontend if available
	if _, err := fs.Stat(staticFS, "static/index.html"); err == nil {
		sub, _ := fs.Sub(staticFS, "static")
		fileServer := http.FileServer(http.FS(sub))

		r.GET("/assets/*filepath", gin.WrapH(fileServer))
		r.GET("/favicon.ico", gin.WrapH(fileServer))

		indexHTML, _ := fs.ReadFile(staticFS, "static/index.html")
		serveIndex := func(c *gin.Context) {
			c.Data(200, "text/html; charset=utf-8", indexHTML)
		}

		r.GET("/", serveIndex)
		r.NoRoute(func(c *gin.Context) {
			if strings.HasPrefix(c.Request.URL.Path, "/api/") || strings.HasPrefix(c.Request.URL.Path, "/v1/") {
				c.JSON(404, gin.H{"error": "Not found"})
				return
			}
			serveIndex(c)
		})

		log.Println("Serving embedded frontend")
	}

	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	url := fmt.Sprintf("http://localhost:%s", cfg.Port)
	log.Printf("Skylark Router starting on %s", addr)

	// Auto-open browser only when: frontend is embedded AND not running as Tauri sidecar.
	if _, err := fs.Stat(staticFS, "static/index.html"); err == nil && os.Getenv("TAURI_APP") != "1" {
		go openBrowser(url)
	}

	if err := r.Run(addr); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
