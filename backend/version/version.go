package version

// These variables are set at build time via -ldflags.
// Default values are used during development (go run / go build without flags).
var (
	Version   = "dev"
	GitCommit = "unknown"
	BuildTime = "unknown"
)
