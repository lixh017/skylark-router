package handlers

import (
	"fmt"
	"skylark-router/database"
	"skylark-router/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type StatsResponse struct {
	TotalRequests    int64          `json:"total_requests"`
	SuccessRequests  int64          `json:"success_requests"`
	FailedRequests   int64          `json:"failed_requests"`
	AvgLatency       float64        `json:"avg_latency"`
	TotalTokens      int64          `json:"total_tokens"`
	TotalCostUSD     float64        `json:"total_cost_usd"`
	ProviderStats    []ProviderStat `json:"provider_stats"`
	RecentRequests   []models.UsageLog `json:"recent_requests"`
}

type ProviderStat struct {
	ProviderName string  `json:"provider_name"`
	RequestCount int64   `json:"request_count"`
	SuccessCount int64   `json:"success_count"`
	AvgLatency   float64 `json:"avg_latency"`
	TotalTokens  int64   `json:"total_tokens"`
	CostUSD      float64 `json:"cost_usd"`
}

func GetStats(c *gin.Context) {
	// Time range: default last 24 hours
	since := time.Now().Add(-24 * time.Hour)
	if q := c.Query("since"); q != "" {
		if t, err := time.Parse(time.RFC3339, q); err == nil {
			since = t
		}
	}

	var stats StatsResponse

	db := database.DB.Model(&models.UsageLog{}).Where("created_at > ?", since)

	db.Count(&stats.TotalRequests)
	db.Where("success = ?", true).Count(&stats.SuccessRequests)
	stats.FailedRequests = stats.TotalRequests - stats.SuccessRequests

	var avgLatency *float64
	database.DB.Model(&models.UsageLog{}).Where("created_at > ?", since).
		Select("AVG(latency)").Row().Scan(&avgLatency)
	if avgLatency != nil {
		stats.AvgLatency = *avgLatency
	}

	database.DB.Model(&models.UsageLog{}).Where("created_at > ?", since).
		Select("COALESCE(SUM(prompt_tokens + completion_tokens), 0)").Row().Scan(&stats.TotalTokens)

	var totalCost *float64
	database.DB.Model(&models.UsageLog{}).Where("created_at > ?", since).
		Select("COALESCE(SUM(cost_usd), 0)").Row().Scan(&totalCost)
	if totalCost != nil {
		stats.TotalCostUSD = *totalCost
	}

	// Per-provider stats
	rows, err := database.DB.Model(&models.UsageLog{}).
		Where("created_at > ?", since).
		Select("provider_name, COUNT(*) as cnt, SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_cnt, AVG(latency) as avg_lat, COALESCE(SUM(prompt_tokens + completion_tokens), 0) as tokens, COALESCE(SUM(cost_usd), 0) as cost").
		Group("provider_name").Rows()
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var ps ProviderStat
			rows.Scan(&ps.ProviderName, &ps.RequestCount, &ps.SuccessCount, &ps.AvgLatency, &ps.TotalTokens, &ps.CostUSD)
			stats.ProviderStats = append(stats.ProviderStats, ps)
		}
	}

	// Recent requests
	database.DB.Where("created_at > ?", since).
		Order("created_at desc").Limit(50).Find(&stats.RecentRequests)

	c.JSON(http.StatusOK, stats)
}

type TimeseriesPoint struct {
	Timestamp  string  `json:"ts"`
	Requests   int64   `json:"requests"`
	Errors     int64   `json:"errors"`
	AvgLatency float64 `json:"avg_latency"`
	Tokens     int64   `json:"tokens"`
	CostUSD    float64 `json:"cost_usd"`
}

// GetTimeseries returns per-bucket stats for charting.
// Query params: since (RFC3339, default 24h), interval ("1h" | "1d", default "1h")
func GetTimeseries(c *gin.Context) {
	since := time.Now().Add(-24 * time.Hour)
	if q := c.Query("since"); q != "" {
		if t, err := time.Parse(time.RFC3339, q); err == nil {
			since = t
		}
	}

	interval := c.DefaultQuery("interval", "1h")
	var fmtStr string
	switch interval {
	case "1d":
		fmtStr = "%Y-%m-%d 00:00:00"
	default: // 1h
		fmtStr = "%Y-%m-%d %H:00:00"
	}

	selectExpr := fmt.Sprintf(
		"strftime('%s', created_at) as ts, COUNT(*) as requests, "+
			"SUM(CASE WHEN success THEN 0 ELSE 1 END) as errors, "+
			"AVG(latency) as avg_lat, "+
			"COALESCE(SUM(prompt_tokens+completion_tokens),0) as tokens, "+
			"COALESCE(SUM(cost_usd),0) as cost_usd",
		fmtStr,
	)

	rows, err := database.DB.Model(&models.UsageLog{}).
		Where("created_at > ?", since).
		Select(selectExpr).
		Group("ts").
		Order("ts asc").
		Rows()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	points := []TimeseriesPoint{}
	for rows.Next() {
		var p TimeseriesPoint
		rows.Scan(&p.Timestamp, &p.Requests, &p.Errors, &p.AvgLatency, &p.Tokens, &p.CostUSD)
		points = append(points, p)
	}
	c.JSON(http.StatusOK, points)
}
