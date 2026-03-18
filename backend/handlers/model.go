package handlers

import (
	"skylark-router/database"
	"skylark-router/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

func ListModels(c *gin.Context) {
	var modelList []models.Model
	database.DB.Preload("Provider").Order("name asc, priority desc").Find(&modelList)
	c.JSON(http.StatusOK, modelList)
}

func GetModel(c *gin.Context) {
	var model models.Model
	if err := database.DB.Preload("Provider").First(&model, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Model not found"})
		return
	}
	c.JSON(http.StatusOK, model)
}

func CreateModel(c *gin.Context) {
	var model models.Model
	if err := c.ShouldBindJSON(&model); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	model.Enabled = true
	if err := database.DB.Create(&model).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	database.DB.Preload("Provider").First(&model, model.ID)
	c.JSON(http.StatusCreated, model)
}

func UpdateModel(c *gin.Context) {
	var model models.Model
	if err := database.DB.First(&model, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Model not found"})
		return
	}

	var input models.Model
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Model(&model).Updates(map[string]interface{}{
		"name":           input.Name,
		"provider_id":    input.ProviderID,
		"provider_model": input.ProviderModel,
		"input_text":     input.InputText,
		"input_image":    input.InputImage,
		"input_audio":    input.InputAudio,
		"input_video":    input.InputVideo,
		"output_text":    input.OutputText,
		"output_audio":   input.OutputAudio,
		"output_image":   input.OutputImage,
		"function_call":  input.FunctionCall,
		"reasoning":      input.Reasoning,
		"priority":       input.Priority,
		"weight":         input.Weight,
		"price_input":    input.PriceInput,
		"price_output":   input.PriceOutput,
		"enabled":        input.Enabled,
	})
	database.DB.Preload("Provider").First(&model, model.ID)
	c.JSON(http.StatusOK, model)
}

func DeleteModel(c *gin.Context) {
	if err := database.DB.Delete(&models.Model{}, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Model deleted"})
}

// ListAvailableModels returns unique model names for OpenAI-compatible /v1/models
func ListAvailableModels(c *gin.Context) {
	var modelList []models.Model
	database.DB.Where("enabled = ?", true).
		Preload("Provider", "enabled = ?", true).
		Find(&modelList)

	names := make(map[string]bool)
	var result []gin.H
	for _, m := range modelList {
		if m.Provider.ID == 0 {
			continue
		}
		if !names[m.Name] {
			names[m.Name] = true
			result = append(result, gin.H{
				"id":       m.Name,
				"object":   "model",
				"owned_by": "skylark-router",
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"object": "list",
		"data":   result,
	})
}
