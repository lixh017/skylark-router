package proxy

import (
	"encoding/json"
	"strings"
	"time"

	"skylark-router/router"
)

// Requirements is an alias for router.Requirements for convenience
type Requirements = router.Requirements

// ===================== Common =====================

type ProxyResult struct {
	StatusCode       int
	Body             []byte
	PromptTokens     int
	CompletionTokens int
	Latency          time.Duration
	Error            error
	RetryAfter       string // Retry-After header value, if present
}

// ===================== OpenAI Format =====================

type OpenAIMessage struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"` // string or []content_parts (for multimodal)
}

type OpenAIChatRequest struct {
	Model       string            `json:"model"`
	Messages    []OpenAIMessage   `json:"messages"`
	Stream      bool              `json:"stream,omitempty"`
	Temperature *float64          `json:"temperature,omitempty"`
	MaxTokens   *int              `json:"max_tokens,omitempty"`
	TopP        *float64          `json:"top_p,omitempty"`
	Tools       json.RawMessage   `json:"tools,omitempty"`       // function calling tools
	ToolChoice  json.RawMessage   `json:"tool_choice,omitempty"` // tool selection strategy
}

type OpenAIChatResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index   int           `json:"index"`
		Message OpenAIMessage `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

// ===================== Anthropic Format =====================

type AnthropicMessage struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"` // string or []ContentBlock
}

type AnthropicContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type AnthropicRequest struct {
	Model       string             `json:"model"`
	Messages    []AnthropicMessage `json:"messages"`
	System      json.RawMessage    `json:"system,omitempty"`  // string or []content_blocks
	MaxTokens   int                `json:"max_tokens"`
	Stream      bool               `json:"stream,omitempty"`
	Temperature *float64           `json:"temperature,omitempty"`
	TopP        *float64           `json:"top_p,omitempty"`
	Tools       json.RawMessage    `json:"tools,omitempty"`       // function calling tools
	ToolChoice  json.RawMessage    `json:"tool_choice,omitempty"` // tool selection
}

type AnthropicResponse struct {
	ID      string                  `json:"id"`
	Type    string                  `json:"type"`
	Role    string                  `json:"role"`
	Content []AnthropicContentBlock `json:"content"`
	Model   string                  `json:"model"`
	Usage   struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
	StopReason string `json:"stop_reason"`
}

// ===================== Capability Detection =====================

// DetectOpenAIRequirements checks what capabilities an OpenAI request needs
func DetectOpenAIRequirements(req *OpenAIChatRequest) Requirements {
	var reqs Requirements

	// Check for tools/function call
	if len(req.Tools) > 0 && string(req.Tools) != "null" {
		reqs.NeedsFunctionCall = true
	}

	// Check for multimodal content in messages
	for _, msg := range req.Messages {
		var parts []struct {
			Type string `json:"type"`
		}
		if json.Unmarshal(msg.Content, &parts) == nil && len(parts) > 0 {
			for _, p := range parts {
				if p.Type == "image_url" || p.Type == "image" {
					reqs.NeedsInputImage = true
				}
				if p.Type == "input_audio" {
					reqs.NeedsInputAudio = true
				}
			}
		}
	}
	return reqs
}

// DetectAnthropicRequirements checks what capabilities an Anthropic request needs
func DetectAnthropicRequirements(req *AnthropicRequest) Requirements {
	var reqs Requirements

	// Check for tools
	if len(req.Tools) > 0 && string(req.Tools) != "null" {
		reqs.NeedsFunctionCall = true
	}

	// Check for multimodal content blocks
	for _, msg := range req.Messages {
		var blocks []struct {
			Type   string `json:"type"`
			Source struct {
				MediaType string `json:"media_type"`
			} `json:"source"`
		}
		if json.Unmarshal(msg.Content, &blocks) == nil {
			for _, b := range blocks {
				if b.Type == "image" {
					reqs.NeedsInputImage = true
				}
				if b.Type == "document" && strings.HasPrefix(b.Source.MediaType, "audio/") {
					reqs.NeedsInputAudio = true
				}
				if b.Type == "video" {
					reqs.NeedsInputVideo = true
				}
			}
		}
	}
	return reqs
}

// ===================== Converters =====================

// getContentText extracts text from OpenAI content (string or []parts)
func getContentText(raw json.RawMessage) string {
	var str string
	if json.Unmarshal(raw, &str) == nil {
		return str
	}
	var parts []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal(raw, &parts) == nil {
		var result string
		for _, p := range parts {
			if p.Type == "text" {
				result += p.Text
			}
		}
		return result
	}
	return ""
}

// convertOpenAIContentToAnthropic converts OpenAI content parts to Anthropic format
func convertOpenAIContentToAnthropic(raw json.RawMessage) json.RawMessage {
	// If it's a plain string, return as-is
	var str string
	if json.Unmarshal(raw, &str) == nil {
		return raw
	}

	// Parse as array of parts
	var parts []json.RawMessage
	if json.Unmarshal(raw, &parts) != nil {
		return raw
	}

	type partType struct {
		Type string `json:"type"`
	}
	type imageURLPart struct {
		Type     string `json:"type"`
		ImageURL struct {
			URL string `json:"url"`
		} `json:"image_url"`
	}
	type inputAudioPart struct {
		Type       string `json:"type"`
		InputAudio struct {
			Data   string `json:"data"`
			Format string `json:"format"`
		} `json:"input_audio"`
	}
	type videoURLPart struct {
		Type     string `json:"type"`
		VideoURL struct {
			URL      string `json:"url"`
			MimeType string `json:"mime_type"`
		} `json:"video_url"`
	}

	extractBase64 := func(dataURL string) string {
		idx := strings.Index(dataURL, ",")
		if idx == -1 {
			return dataURL
		}
		return dataURL[idx+1:]
	}
	extractMimeType := func(dataURL string) string {
		// data:image/jpeg;base64,...
		if len(dataURL) > 5 && dataURL[:5] == "data:" {
			end := strings.Index(dataURL, ";")
			if end != -1 {
				return dataURL[5:end]
			}
		}
		return "image/jpeg"
	}

	converted := make([]interface{}, 0, len(parts))
	for _, p := range parts {
		var pt partType
		if json.Unmarshal(p, &pt) != nil {
			converted = append(converted, p)
			continue
		}
		switch pt.Type {
		case "image_url":
			var img imageURLPart
			if json.Unmarshal(p, &img) == nil {
				converted = append(converted, map[string]interface{}{
					"type": "image",
					"source": map[string]interface{}{
						"type":       "base64",
						"media_type": extractMimeType(img.ImageURL.URL),
						"data":       extractBase64(img.ImageURL.URL),
					},
				})
			} else {
				converted = append(converted, p)
			}
		case "input_audio":
			var audio inputAudioPart
			if json.Unmarshal(p, &audio) == nil {
				converted = append(converted, map[string]interface{}{
					"type": "document",
					"source": map[string]interface{}{
						"type":       "base64",
						"media_type": "audio/" + audio.InputAudio.Format,
						"data":       audio.InputAudio.Data,
					},
				})
			} else {
				converted = append(converted, p)
			}
		case "video_url":
			var vid videoURLPart
			if json.Unmarshal(p, &vid) == nil {
				converted = append(converted, map[string]interface{}{
					"type": "video",
					"source": map[string]interface{}{
						"type":       "base64",
						"media_type": vid.VideoURL.MimeType,
						"data":       extractBase64(vid.VideoURL.URL),
					},
				})
			} else {
				converted = append(converted, p)
			}
		default:
			converted = append(converted, p)
		}
	}

	result, err := json.Marshal(converted)
	if err != nil {
		return raw
	}
	return result
}

// OpenAIToAnthropic converts an OpenAI chat request to Anthropic format
func OpenAIToAnthropic(req OpenAIChatRequest) AnthropicRequest {
	ar := AnthropicRequest{
		Model:       req.Model,
		Stream:      req.Stream,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		MaxTokens:   4096,
		Tools:       req.Tools,
		ToolChoice:  req.ToolChoice,
	}
	if req.MaxTokens != nil {
		ar.MaxTokens = *req.MaxTokens
	}

	for _, msg := range req.Messages {
		if msg.Role == "system" {
			text := getContentText(msg.Content)
			ar.System, _ = json.Marshal(text)
			continue
		}
		ar.Messages = append(ar.Messages, AnthropicMessage{
			Role:    msg.Role,
			Content: convertOpenAIContentToAnthropic(msg.Content),
		})
	}

	if len(ar.Messages) == 0 {
		ar.Messages = []AnthropicMessage{}
	}
	return ar
}

// AnthropicResponseToOpenAI converts an Anthropic response to OpenAI format
func AnthropicResponseToOpenAI(resp AnthropicResponse) OpenAIChatResponse {
	content := ""
	for _, block := range resp.Content {
		if block.Type == "text" {
			content += block.Text
		}
	}
	return OpenAIChatResponse{
		ID:      resp.ID,
		Object:  "chat.completion",
		Model:   resp.Model,
		Choices: []struct {
			Index   int           `json:"index"`
			Message OpenAIMessage `json:"message"`
		}{
			{Index: 0, Message: OpenAIMessage{Role: "assistant", Content: mustMarshal(content)}},
		},
		Usage: struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		}{
			PromptTokens:     resp.Usage.InputTokens,
			CompletionTokens: resp.Usage.OutputTokens,
			TotalTokens:      resp.Usage.InputTokens + resp.Usage.OutputTokens,
		},
	}
}

// AnthropicToOpenAI converts an Anthropic request to OpenAI format
func AnthropicToOpenAI(req AnthropicRequest) OpenAIChatRequest {
	or := OpenAIChatRequest{
		Model:       req.Model,
		Stream:      req.Stream,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		Tools:       req.Tools,
		ToolChoice:  req.ToolChoice,
	}
	if req.MaxTokens > 0 {
		or.MaxTokens = &req.MaxTokens
	}

	if len(req.System) > 0 && string(req.System) != "null" {
		var sysText string
		if json.Unmarshal(req.System, &sysText) == nil && sysText != "" {
			or.Messages = append(or.Messages, OpenAIMessage{Role: "system", Content: mustMarshal(sysText)})
		}
	}

	for _, msg := range req.Messages {
		text := ""
		var str string
		if json.Unmarshal(msg.Content, &str) == nil {
			text = str
		} else {
			var blocks []AnthropicContentBlock
			if json.Unmarshal(msg.Content, &blocks) == nil {
				for _, b := range blocks {
					if b.Type == "text" {
						text += b.Text
					}
				}
			}
		}
		or.Messages = append(or.Messages, OpenAIMessage{Role: msg.Role, Content: mustMarshal(text)})
	}

	return or
}

// OpenAIResponseToAnthropic converts an OpenAI response to Anthropic format
func OpenAIResponseToAnthropic(resp OpenAIChatResponse) AnthropicResponse {
	content := ""
	if len(resp.Choices) > 0 {
		content = getContentText(resp.Choices[0].Message.Content)
	}
	return AnthropicResponse{
		ID:   resp.ID,
		Type: "message",
		Role: "assistant",
		Content: []AnthropicContentBlock{
			{Type: "text", Text: content},
		},
		Model: resp.Model,
		Usage: struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		}{
			InputTokens:  resp.Usage.PromptTokens,
			OutputTokens: resp.Usage.CompletionTokens,
		},
		StopReason: "end_turn",
	}
}

func mustMarshal(v interface{}) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}
