package router

import (
	"math/rand/v2"

	"skylark-router/database"
	"skylark-router/models"
)

// ModelRoute represents a resolved route for a model request
type ModelRoute struct {
	Model    models.Model
	Provider models.Provider
}

// Requirements describes what capabilities the request needs
type Requirements struct {
	NeedsInputImage   bool
	NeedsInputAudio   bool
	NeedsInputVideo   bool
	NeedsOutputAudio  bool
	NeedsOutputImage  bool
	NeedsFunctionCall bool
	NeedsReasoning    bool
}

// FindRoutes returns all available routes for a given model name, sorted by priority desc
func FindRoutes(modelName string) ([]ModelRoute, error) {
	var modelList []models.Model
	err := database.DB.
		Where("name = ? AND enabled = ?", modelName, true).
		Preload("Provider", "enabled = ?", true).
		Order("priority desc").
		Find(&modelList).Error
	if err != nil {
		return nil, err
	}

	var routes []ModelRoute
	for _, m := range modelList {
		if m.Provider.ID == 0 {
			continue // provider disabled or not found
		}
		routes = append(routes, ModelRoute{Model: m, Provider: m.Provider})
	}
	return routes, nil
}

// FindAllRoutes returns all available routes across every model, sorted by priority desc.
// Used for wildcard "*" routing.
func FindAllRoutes() ([]ModelRoute, error) {
	var modelList []models.Model
	err := database.DB.
		Where("enabled = ?", true).
		Preload("Provider", "enabled = ?", true).
		Order("priority desc").
		Find(&modelList).Error
	if err != nil {
		return nil, err
	}

	var routes []ModelRoute
	for _, m := range modelList {
		if m.Provider.ID == 0 {
			continue
		}
		routes = append(routes, ModelRoute{Model: m, Provider: m.Provider})
	}
	return routes, nil
}

// filterByCapabilities removes routes that don't meet the requirements
func filterByCapabilities(routes []ModelRoute, reqs *Requirements) []ModelRoute {
	if reqs == nil {
		return routes
	}

	var filtered []ModelRoute
	for _, r := range routes {
		if reqs.NeedsInputImage && !r.Model.InputImage {
			continue
		}
		if reqs.NeedsInputAudio && !r.Model.InputAudio {
			continue
		}
		if reqs.NeedsInputVideo && !r.Model.InputVideo {
			continue
		}
		if reqs.NeedsOutputAudio && !r.Model.OutputAudio {
			continue
		}
		if reqs.NeedsOutputImage && !r.Model.OutputImage {
			continue
		}
		if reqs.NeedsFunctionCall && !r.Model.FunctionCall {
			continue
		}
		if reqs.NeedsReasoning && !r.Model.Reasoning {
			continue
		}
		filtered = append(filtered, r)
	}
	return filtered
}

// SelectRoute picks the best route using priority-first strategy
// If multiple routes have the same priority, weighted random among them
// reqs can be nil if no capability filtering is needed
// modelName "*" selects from all available models
func SelectRoute(modelName string, reqs *Requirements) (*ModelRoute, []ModelRoute, error) {
	var routes []ModelRoute
	var err error

	if modelName == "auto" {
		routes, err = FindAllRoutes()
	} else {
		routes, err = FindRoutes(modelName)
	}
	if err != nil {
		return nil, nil, err
	}

	// Filter by capabilities
	routes = filterByCapabilities(routes, reqs)

	if len(routes) == 0 {
		return nil, nil, nil
	}

	// Group by highest priority
	topPriority := routes[0].Model.Priority
	var topRoutes []ModelRoute
	for _, r := range routes {
		if r.Model.Priority == topPriority {
			topRoutes = append(topRoutes, r)
		}
	}

	// Weighted random within same priority
	totalWeight := 0
	for _, r := range topRoutes {
		w := r.Model.Weight
		if w < 1 {
			w = 1
		}
		totalWeight += w
	}

	pick := rand.IntN(totalWeight)
	selectedIdx := 0
	for i, r := range topRoutes {
		w := r.Model.Weight
		if w < 1 {
			w = 1
		}
		pick -= w
		if pick < 0 {
			selectedIdx = i
			break
		}
	}

	selected := topRoutes[selectedIdx]

	// Return all routes for fallback (excluding selected)
	var fallbacks []ModelRoute
	for _, r := range routes {
		if r.Model.ID != selected.Model.ID {
			fallbacks = append(fallbacks, r)
		}
	}

	return &selected, fallbacks, nil
}
