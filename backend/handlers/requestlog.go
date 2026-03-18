package handlers

import (
	"net/http"
	"strconv"

	"skylark-router/database"
	"skylark-router/models"

	"github.com/gin-gonic/gin"
)

// GET /api/request-logs
func ListRequestLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}

	query := database.DB.Model(&models.RequestLog{})

	if model := c.Query("model"); model != "" {
		query = query.Where("model_name = ?", model)
	}
	if since := c.Query("since"); since != "" {
		query = query.Where("created_at >= ?", since)
	}

	var total int64
	query.Count(&total)

	var logs []models.RequestLog
	query.Order("created_at desc").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&logs)

	// Clear bodies in list view
	for i := range logs {
		logs[i].RequestBody = ""
		logs[i].ResponseBody = ""
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GET /api/request-logs/:id
func GetRequestLog(c *gin.Context) {
	var log models.RequestLog
	if err := database.DB.First(&log, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Log not found"})
		return
	}
	c.JSON(http.StatusOK, log)
}

// DELETE /api/request-logs
func DeleteRequestLogs(c *gin.Context) {
	before := c.Query("before")
	if before == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "before parameter is required"})
		return
	}

	result := database.DB.Where("created_at < ?", before).Delete(&models.RequestLog{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": result.RowsAffected})
}
