package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"skylark-router/config"

	"github.com/gin-gonic/gin"
)

type SearchResultItem struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}

// Search handles GET /api/search?q=<query>
func Search(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing query parameter q"})
		return
	}

	config.Mu.RLock()
	provider := config.C.SearchProvider
	apiKey := config.C.SearchAPIKey
	config.Mu.RUnlock()

	if provider == "" || apiKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "search not configured, please set search_provider and search_api_key in Settings"})
		return
	}

	var results []SearchResultItem
	var err error

	switch provider {
	case "tavily":
		results, err = searchTavily(query, apiKey)
	case "serper":
		results, err = searchSerper(query, apiKey)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("unknown search provider: %s", provider)})
		return
	}

	if err != nil {
		if strings.Contains(err.Error(), "429") {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "搜索 API 额度已用尽，请升级套餐或等待下月重置（Tavily 每月 1,000 次，Serper 2,500 次一次性）"})
		} else {
			c.JSON(http.StatusBadGateway, gin.H{"error": "search failed: " + err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, results)
}

func searchTavily(query, apiKey string) ([]SearchResultItem, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"api_key":     apiKey,
		"query":       query,
		"max_results": 5,
	})

	resp, err := http.Post("https://api.tavily.com/search", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%d: %s", resp.StatusCode, string(data))
	}

	var result struct {
		Results []struct {
			Title   string `json:"title"`
			URL     string `json:"url"`
			Content string `json:"content"`
		} `json:"results"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	items := make([]SearchResultItem, 0, len(result.Results))
	for _, r := range result.Results {
		items = append(items, SearchResultItem{Title: r.Title, URL: r.URL, Snippet: r.Content})
	}
	return items, nil
}

func searchSerper(query, apiKey string) ([]SearchResultItem, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"q":   query,
		"num": 5,
	})

	req, _ := http.NewRequest("POST", "https://google.serper.dev/search", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-KEY", apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%d: %s", resp.StatusCode, string(data))
	}

	var result struct {
		Organic []struct {
			Title   string `json:"title"`
			Link    string `json:"link"`
			Snippet string `json:"snippet"`
		} `json:"organic"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	items := make([]SearchResultItem, 0, len(result.Organic))
	for _, r := range result.Organic {
		items = append(items, SearchResultItem{Title: r.Title, URL: r.Link, Snippet: r.Snippet})
	}
	return items, nil
}
