package config

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"text/template"

	"github.com/goccy/go-yaml"
)

// Mu protects concurrent access to the global config C.
var Mu sync.RWMutex

type Config struct {
	Host           string
	Port           string
	DBPath         string
	AuthToken      string
	LogRequests    bool
	DefaultModel   string
	SearchProvider string // "tavily" or "serper"
	SearchAPIKey   string
}

// fileConfig mirrors Config but uses yaml tags for user-friendly config file
type fileConfig struct {
	Host           string `yaml:"host"`
	Port           string `yaml:"port"`
	DBPath         string `yaml:"db_path"`
	AuthToken      string `yaml:"auth_token"`
	LogRequests    bool   `yaml:"log_requests"`
	DefaultModel   string `yaml:"default_model"`
	SearchProvider string `yaml:"search_provider"`
	SearchAPIKey   string `yaml:"search_api_key"`
}

var C *Config

// configFilePath returns config.yaml path next to the binary (or cwd in dev).
// The CONFIG_PATH environment variable takes highest priority (used by Tauri to
// inject the app-data directory path).
func configFilePath() string {
	if p := os.Getenv("CONFIG_PATH"); p != "" {
		return p
	}
	exe, err := os.Executable()
	if err != nil {
		return "config.yaml"
	}
	// In `go run`, executable is a temp file — use cwd instead
	if strings.Contains(exe, os.TempDir()) || strings.Contains(exe, "go-build") {
		return "config.yaml"
	}
	return filepath.Join(filepath.Dir(exe), "config.yaml")
}

var defaultConfigTemplate = `# Skylark Router Configuration
# Changes take effect on restart.

# Bind address — use 0.0.0.0 to accept connections from all interfaces,
# or 127.0.0.1 to restrict to localhost only
host: "0.0.0.0"

# Port to listen on
port: "8080"

# Path to the SQLite database file
# Relative paths are resolved from the binary's directory
db_path: "skylark-router.db"

# Admin token to protect the dashboard (/api/* routes)
# Leave empty to disable authentication (not recommended in production)
auth_token: ""

# Default model to use when the request does not specify a model
# Use "auto" to automatically select the highest-priority model across all mappings
# Leave empty to require model in every request
default_model: ""

# Set to true to log full request/response bodies (for debugging)
log_requests: false
`

func writeDefaultConfig(path string) {
	if err := os.WriteFile(path, []byte(defaultConfigTemplate), 0644); err != nil {
		log.Printf("Warning: could not write default config to %s: %v", path, err)
		return
	}
	log.Printf("Created default config file: %s", path)
}

func Load() *Config {
	cfgPath := configFilePath()

	// Generate default config on first run
	if _, err := os.Stat(cfgPath); os.IsNotExist(err) {
		writeDefaultConfig(cfgPath)
	}

	// Load config file
	fc := fileConfig{
		Host:   "0.0.0.0",
		Port:   "8080",
		DBPath: "skylark-router.db",
	}
	if data, err := os.ReadFile(cfgPath); err == nil {
		if err := yaml.Unmarshal(data, &fc); err != nil {
			log.Printf("Warning: could not parse %s: %v", cfgPath, err)
		}
	}

	// Environment variables override config file
	if v := os.Getenv("HOST"); v != "" {
		fc.Host = v
	}
	if v := os.Getenv("PORT"); v != "" {
		fc.Port = v
	}
	if v := os.Getenv("DB_PATH"); v != "" {
		fc.DBPath = v
	}
	if v := os.Getenv("AUTH_TOKEN"); v != "" {
		fc.AuthToken = v
	}
	if v := os.Getenv("LOG_REQUESTS"); v != "" {
		fc.LogRequests = strings.EqualFold(v, "true")
	}
	if v := os.Getenv("DEFAULT_MODEL"); v != "" {
		fc.DefaultModel = v
	}
	if v := os.Getenv("SEARCH_PROVIDER"); v != "" {
		fc.SearchProvider = v
	}
	if v := os.Getenv("SEARCH_API_KEY"); v != "" {
		fc.SearchAPIKey = v
	}

	// Resolve db_path relative to binary dir (not cwd) on non-dev builds
	if !filepath.IsAbs(fc.DBPath) {
		exe, err := os.Executable()
		if err == nil && !strings.Contains(exe, os.TempDir()) && !isGoBuild(exe) {
			fc.DBPath = filepath.Join(filepath.Dir(exe), fc.DBPath)
		}
	}

	C = &Config{
		Host:           fc.Host,
		Port:           fc.Port,
		DBPath:         fc.DBPath,
		AuthToken:      fc.AuthToken,
		LogRequests:    fc.LogRequests,
		DefaultModel:   fc.DefaultModel,
		SearchProvider: fc.SearchProvider,
		SearchAPIKey:   fc.SearchAPIKey,
	}

	log.Printf("Config loaded from %s (host=%s, port=%s, db=%s, default_model=%q, log_requests=%v)",
		cfgPath, C.Host, C.Port, C.DBPath, C.DefaultModel, C.LogRequests)

	return C
}

func isGoBuild(exe string) bool {
	if runtime.GOOS == "windows" {
		return strings.Contains(exe, "go-build")
	}
	return strings.Contains(exe, "go-build") || strings.Contains(exe, fmt.Sprintf("%c", os.PathSeparator)+"tmp"+fmt.Sprintf("%c", os.PathSeparator))
}

// ConfigFilePath returns the resolved config file path (exported for handlers).
func ConfigFilePath() string {
	return configFilePath()
}

var saveConfigTmpl = template.Must(template.New("cfg").Parse(`# Skylark Router Configuration
# Changes take effect on restart.

# Bind address — use 0.0.0.0 to accept connections from all interfaces,
# or 127.0.0.1 to restrict to localhost only
host: "{{.Host}}"

# Port to listen on
port: "{{.Port}}"

# Path to the SQLite database file
# Relative paths are resolved from the binary's directory
db_path: "{{.DBPath}}"

# Admin token to protect the dashboard (/api/* routes)
# Leave empty to disable authentication (not recommended in production)
auth_token: "{{.AuthToken}}"

# Default model to use when the request does not specify a model
# Use "auto" to automatically select the highest-priority model across all mappings
# Leave empty to require model in every request
default_model: "{{.DefaultModel}}"

# Set to true to log full request/response bodies (for debugging)
log_requests: {{.LogRequests}}

# Web search integration: "tavily" or "serper"
search_provider: "{{.SearchProvider}}"
search_api_key: "{{.SearchAPIKey}}"
`))

// Save writes the current config to disk atomically (write tmp, then rename).
func Save(cfg *Config) error {
	cfgPath := configFilePath()

	// Ensure parent directory exists
	if dir := filepath.Dir(cfgPath); dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("create config dir: %w", err)
		}
	}

	tmpPath := cfgPath + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("create tmp config: %w", err)
	}

	if err := saveConfigTmpl.Execute(f, cfg); err != nil {
		f.Close()
		os.Remove(tmpPath)
		return fmt.Errorf("write config: %w", err)
	}
	f.Close()

	if err := os.Rename(tmpPath, cfgPath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("rename config: %w", err)
	}

	log.Printf("Config saved to %s", cfgPath)
	return nil
}
