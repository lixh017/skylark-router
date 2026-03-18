package handlers

import (
	"skylark-router/version"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetVersion(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"version":    version.Version,
		"git_commit": version.GitCommit,
		"build_time": version.BuildTime,
	})
}
