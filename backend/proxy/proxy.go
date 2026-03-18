package proxy

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"skylark-router/models"
	"skylark-router/router"
)

var httpClient = &http.Client{Timeout: 120 * time.Second}

// buildUpstreamRequest creates the HTTP request for the upstream provider
func buildUpstreamRequest(route *router.ModelRoute, body []byte) (*http.Request, error) {
	var url string
	var req *http.Request

	base := strings.TrimRight(route.Provider.BaseURL, "/")

	switch route.Provider.Protocol {
	case models.ProtocolAnthropic:
		url = base + "/v1/messages"
		r, err := http.NewRequest("POST", url, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("x-api-key", route.Provider.APIKey)
		r.Header.Set("anthropic-version", "2023-06-01")
		req = r
	default: // openai — base already includes the version path (e.g. /v1)
		url = base + "/chat/completions"
		r, err := http.NewRequest("POST", url, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Authorization", "Bearer "+route.Provider.APIKey)
		req = r
	}

	return req, nil
}

// ForwardOpenAI handles a request where the incoming format is OpenAI
func ForwardOpenAI(route *router.ModelRoute, req OpenAIChatRequest) *ProxyResult {
	start := time.Now()
	req.Model = route.Model.ProviderModel

	var body []byte
	var err error

	if route.Provider.Protocol == models.ProtocolAnthropic {
		// Convert OpenAI request → Anthropic format
		ar := OpenAIToAnthropic(req)
		ar.Model = route.Model.ProviderModel
		body, err = json.Marshal(ar)
	} else {
		body, err = json.Marshal(req)
	}
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("marshal request: %w", err)}
	}

	httpReq, err := buildUpstreamRequest(route, body)
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("create request: %w", err)}
	}

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("upstream request: %w", err), Latency: time.Since(start)}
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("read response: %w", err), Latency: time.Since(start)}
	}

	result := &ProxyResult{StatusCode: resp.StatusCode, Body: respBody, Latency: time.Since(start)}

	if resp.StatusCode != http.StatusOK {
		result.Error = fmt.Errorf("upstream returned %d: %s", resp.StatusCode, string(respBody))
		if ra := resp.Header.Get("Retry-After"); ra != "" {
			result.RetryAfter = ra
		}
		return result
	}

	// Parse response & convert if needed
	if route.Provider.Protocol == models.ProtocolAnthropic {
		var ar AnthropicResponse
		if err := json.Unmarshal(respBody, &ar); err == nil {
			result.PromptTokens = ar.Usage.InputTokens
			result.CompletionTokens = ar.Usage.OutputTokens
			// Convert response to OpenAI format
			openaiResp := AnthropicResponseToOpenAI(ar)
			result.Body, _ = json.Marshal(openaiResp)
		}
	} else {
		var or OpenAIChatResponse
		if err := json.Unmarshal(respBody, &or); err == nil {
			result.PromptTokens = or.Usage.PromptTokens
			result.CompletionTokens = or.Usage.CompletionTokens
		}
	}

	return result
}

// ForwardAnthropic handles a request where the incoming format is Anthropic
func ForwardAnthropic(route *router.ModelRoute, req AnthropicRequest) *ProxyResult {
	start := time.Now()
	req.Model = route.Model.ProviderModel

	var body []byte
	var err error

	if route.Provider.Protocol == models.ProtocolAnthropic {
		body, err = json.Marshal(req)
	} else {
		// Convert Anthropic request → OpenAI format
		or := AnthropicToOpenAI(req)
		or.Model = route.Model.ProviderModel
		body, err = json.Marshal(or)
	}
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("marshal request: %w", err)}
	}

	httpReq, err := buildUpstreamRequest(route, body)
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("create request: %w", err)}
	}

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("upstream request: %w", err), Latency: time.Since(start)}
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("read response: %w", err), Latency: time.Since(start)}
	}

	result := &ProxyResult{StatusCode: resp.StatusCode, Body: respBody, Latency: time.Since(start)}

	if resp.StatusCode != http.StatusOK {
		result.Error = fmt.Errorf("upstream returned %d: %s", resp.StatusCode, string(respBody))
		if ra := resp.Header.Get("Retry-After"); ra != "" {
			result.RetryAfter = ra
		}
		return result
	}

	if route.Provider.Protocol == models.ProtocolAnthropic {
		var ar AnthropicResponse
		if err := json.Unmarshal(respBody, &ar); err == nil {
			result.PromptTokens = ar.Usage.InputTokens
			result.CompletionTokens = ar.Usage.OutputTokens
		}
	} else {
		// Provider is OpenAI, convert response to Anthropic format
		var or OpenAIChatResponse
		if err := json.Unmarshal(respBody, &or); err == nil {
			result.PromptTokens = or.Usage.PromptTokens
			result.CompletionTokens = or.Usage.CompletionTokens
			anthropicResp := OpenAIResponseToAnthropic(or)
			result.Body, _ = json.Marshal(anthropicResp)
		}
	}

	return result
}

// ForwardOpenAIStream handles streaming for OpenAI-format requests
func ForwardOpenAIStream(route *router.ModelRoute, req OpenAIChatRequest, w http.ResponseWriter) *ProxyResult {
	start := time.Now()
	req.Model = route.Model.ProviderModel
	req.Stream = true

	var body []byte
	var err error

	if route.Provider.Protocol == models.ProtocolAnthropic {
		ar := OpenAIToAnthropic(req)
		ar.Model = route.Model.ProviderModel
		ar.Stream = true
		body, err = json.Marshal(ar)
	} else {
		body, err = json.Marshal(req)
	}
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("marshal request: %w", err)}
	}

	httpReq, err := buildUpstreamRequest(route, body)
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("create request: %w", err)}
	}

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("upstream request: %w", err), Latency: time.Since(start)}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		result := &ProxyResult{
			StatusCode: resp.StatusCode, Body: respBody,
			Error:   fmt.Errorf("upstream returned %d: %s", resp.StatusCode, string(respBody)),
			Latency: time.Since(start),
		}
		if ra := resp.Header.Get("Retry-After"); ra != "" {
			result.RetryAfter = ra
		}
		return result
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	flusher, ok := w.(http.Flusher)
	if !ok {
		return &ProxyResult{Error: fmt.Errorf("streaming not supported"), Latency: time.Since(start)}
	}

	result := &ProxyResult{StatusCode: http.StatusOK}

	if route.Provider.Protocol == models.ProtocolAnthropic {
		// Anthropic SSE → OpenAI SSE conversion
		streamAnthropicToOpenAI(resp.Body, w, flusher, result)
	} else {
		// Passthrough OpenAI SSE
		streamPassthrough(resp.Body, w, flusher, result)
	}

	result.Latency = time.Since(start)
	return result
}

// ForwardAnthropicStream handles streaming for Anthropic-format requests
func ForwardAnthropicStream(route *router.ModelRoute, req AnthropicRequest, w http.ResponseWriter) *ProxyResult {
	start := time.Now()
	req.Model = route.Model.ProviderModel
	req.Stream = true

	var body []byte
	var err error

	if route.Provider.Protocol == models.ProtocolAnthropic {
		body, err = json.Marshal(req)
	} else {
		or := AnthropicToOpenAI(req)
		or.Model = route.Model.ProviderModel
		or.Stream = true
		body, err = json.Marshal(or)
	}
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("marshal request: %w", err)}
	}

	httpReq, err := buildUpstreamRequest(route, body)
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("create request: %w", err)}
	}

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return &ProxyResult{Error: fmt.Errorf("upstream request: %w", err), Latency: time.Since(start)}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		result := &ProxyResult{
			StatusCode: resp.StatusCode, Body: respBody,
			Error:   fmt.Errorf("upstream returned %d: %s", resp.StatusCode, string(respBody)),
			Latency: time.Since(start),
		}
		if ra := resp.Header.Get("Retry-After"); ra != "" {
			result.RetryAfter = ra
		}
		return result
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	flusher, ok := w.(http.Flusher)
	if !ok {
		return &ProxyResult{Error: fmt.Errorf("streaming not supported"), Latency: time.Since(start)}
	}

	result := &ProxyResult{StatusCode: http.StatusOK}

	if route.Provider.Protocol == models.ProtocolAnthropic {
		// Passthrough Anthropic SSE
		streamPassthrough(resp.Body, w, flusher, result)
	} else {
		// OpenAI SSE → Anthropic SSE conversion
		streamOpenAIToAnthropic(resp.Body, w, flusher, result)
	}

	result.Latency = time.Since(start)
	return result
}

// streamPassthrough passes SSE data through unchanged, extracting usage info
func streamPassthrough(body io.Reader, w http.ResponseWriter, flusher http.Flusher, result *ProxyResult) {
	scanner := bufio.NewScanner(body)
	for scanner.Scan() {
		line := scanner.Text()
		fmt.Fprintf(w, "%s\n", line)
		flusher.Flush()

		if strings.HasPrefix(line, "data: ") && line != "data: [DONE]" {
			data := line[6:]
			// Try OpenAI usage
			var chunk struct {
				Usage *struct {
					PromptTokens     int `json:"prompt_tokens"`
					CompletionTokens int `json:"completion_tokens"`
				} `json:"usage,omitempty"`
			}
			if json.Unmarshal([]byte(data), &chunk) == nil && chunk.Usage != nil {
				result.PromptTokens = chunk.Usage.PromptTokens
				result.CompletionTokens = chunk.Usage.CompletionTokens
			}
		}
	}
}

// streamAnthropicToOpenAI converts Anthropic SSE stream to OpenAI SSE format
func streamAnthropicToOpenAI(body io.Reader, w http.ResponseWriter, flusher http.Flusher, result *ProxyResult) {
	scanner := bufio.NewScanner(body)
	for scanner.Scan() {
		line := scanner.Text()

		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := line[6:]

		var event struct {
			Type  string `json:"type"`
			Index int    `json:"index"`
			Delta *struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta,omitempty"`
			Usage *struct {
				InputTokens  int `json:"input_tokens"`
				OutputTokens int `json:"output_tokens"`
			} `json:"usage,omitempty"`
			Message *struct {
				Usage struct {
					InputTokens  int `json:"input_tokens"`
					OutputTokens int `json:"output_tokens"`
				} `json:"usage"`
			} `json:"message,omitempty"`
		}
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}

		switch event.Type {
		case "content_block_delta":
			if event.Delta != nil && event.Delta.Text != "" {
				chunk := map[string]interface{}{
					"choices": []map[string]interface{}{
						{"index": 0, "delta": map[string]string{"content": event.Delta.Text}},
					},
				}
				out, _ := json.Marshal(chunk)
				fmt.Fprintf(w, "data: %s\n\n", out)
				flusher.Flush()
			}
		case "message_delta":
			if event.Usage != nil {
				result.PromptTokens = event.Usage.InputTokens
				result.CompletionTokens = event.Usage.OutputTokens
			}
		case "message_start":
			if event.Message != nil {
				result.PromptTokens = event.Message.Usage.InputTokens
			}
		case "message_stop":
			fmt.Fprintf(w, "data: [DONE]\n\n")
			flusher.Flush()
		}
	}
}

// streamOpenAIToAnthropic converts OpenAI SSE stream to Anthropic SSE format
func streamOpenAIToAnthropic(body io.Reader, w http.ResponseWriter, flusher http.Flusher, result *ProxyResult) {
	// Send message_start
	startEvent := map[string]interface{}{
		"type": "message_start",
		"message": map[string]interface{}{
			"id": "msg_proxy", "type": "message", "role": "assistant",
			"content": []interface{}{}, "model": "",
			"usage": map[string]int{"input_tokens": 0, "output_tokens": 0},
		},
	}
	out, _ := json.Marshal(startEvent)
	fmt.Fprintf(w, "event: message_start\ndata: %s\n\n", out)
	flusher.Flush()

	// Send content_block_start
	blockStart := map[string]interface{}{
		"type": "content_block_start", "index": 0,
		"content_block": map[string]string{"type": "text", "text": ""},
	}
	out, _ = json.Marshal(blockStart)
	fmt.Fprintf(w, "event: content_block_start\ndata: %s\n\n", out)
	flusher.Flush()

	scanner := bufio.NewScanner(body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := line[6:]
		if data == "[DONE]" {
			break
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
			Usage *struct {
				PromptTokens     int `json:"prompt_tokens"`
				CompletionTokens int `json:"completion_tokens"`
			} `json:"usage,omitempty"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if chunk.Usage != nil {
			result.PromptTokens = chunk.Usage.PromptTokens
			result.CompletionTokens = chunk.Usage.CompletionTokens
		}

		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			delta := map[string]interface{}{
				"type": "content_block_delta", "index": 0,
				"delta": map[string]string{"type": "text_delta", "text": chunk.Choices[0].Delta.Content},
			}
			out, _ := json.Marshal(delta)
			fmt.Fprintf(w, "event: content_block_delta\ndata: %s\n\n", out)
			flusher.Flush()
		}
	}

	// Send content_block_stop, message_delta, message_stop
	blockStop, _ := json.Marshal(map[string]interface{}{"type": "content_block_stop", "index": 0})
	fmt.Fprintf(w, "event: content_block_stop\ndata: %s\n\n", blockStop)

	msgDelta, _ := json.Marshal(map[string]interface{}{
		"type": "message_delta",
		"delta": map[string]string{"stop_reason": "end_turn"},
		"usage": map[string]int{"output_tokens": result.CompletionTokens},
	})
	fmt.Fprintf(w, "event: message_delta\ndata: %s\n\n", msgDelta)

	msgStop, _ := json.Marshal(map[string]string{"type": "message_stop"})
	fmt.Fprintf(w, "event: message_stop\ndata: %s\n\n", msgStop)
	flusher.Flush()
}
