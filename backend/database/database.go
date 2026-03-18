package database

import (
	"skylark-router/config"
	"skylark-router/models"
	"log"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init() {
	var err error
	DB, err = gorm.Open(sqlite.Open(config.C.DBPath), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// AutoMigrate: creates/updates tables to match current structs (additive only)
	if err := DB.AutoMigrate(
		&models.Provider{},
		&models.Model{},
		&models.UsageLog{},
		&models.APIKey{},
		&models.RequestLog{},
		&models.User{},
	); err != nil {
		log.Fatal("Failed to auto-migrate database:", err)
	}

	// Versioned migrations: data transforms, renames, drops, etc.
	if err := Migrate(DB); err != nil {
		log.Fatal("Failed to run migrations:", err)
	}

	log.Println("Database initialized successfully")
}
