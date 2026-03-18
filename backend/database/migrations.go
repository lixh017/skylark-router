package database

import (
	"fmt"
	"log"

	"gorm.io/gorm"
)

// schemaVersion tracks the current migration version in the database.
type schemaVersion struct {
	ID      int `gorm:"primaryKey"`
	Version int `gorm:"not null;default:0"`
}

// Migration defines a single versioned schema/data migration.
// Up applies the change; Down reverts it.
// Never modify or remove existing entries — only append new ones.
type Migration struct {
	Version     int
	Description string
	Up          func(db *gorm.DB) error
	Down        func(db *gorm.DB) error // nil = not reversible
}

// migrations is the ordered list of all migrations.
var migrations = []Migration{
	// Version 1 — baseline: all tables created by AutoMigrate.
	{
		Version:     1,
		Description: "baseline schema",
		Up:          func(db *gorm.DB) error { return nil },
		Down:        func(db *gorm.DB) error { return nil },
	},

	// Add new migrations here. Example:
	// {
	//     Version:     2,
	//     Description: "add context_length to models",
	//     Up: func(db *gorm.DB) error {
	//         return db.Exec("ALTER TABLE models ADD COLUMN context_length INTEGER DEFAULT 0").Error
	//     },
	//     Down: func(db *gorm.DB) error {
	//         // SQLite does not support DROP COLUMN before 3.35 — recreate table if needed
	//         return db.Exec("ALTER TABLE models DROP COLUMN context_length").Error
	//     },
	// },
}

// ensureVersionTable creates the schema_version table and row if missing.
func ensureVersionTable(db *gorm.DB) (schemaVersion, error) {
	if err := db.AutoMigrate(&schemaVersion{}); err != nil {
		return schemaVersion{}, fmt.Errorf("create schema_version table: %w", err)
	}
	var sv schemaVersion
	result := db.First(&sv, "id = 1")
	if result.Error == gorm.ErrRecordNotFound {
		sv = schemaVersion{ID: 1, Version: 0}
		if err := db.Create(&sv).Error; err != nil {
			return sv, fmt.Errorf("init schema_version: %w", err)
		}
	} else if result.Error != nil {
		return sv, fmt.Errorf("read schema_version: %w", result.Error)
	}
	return sv, nil
}

// Migrate applies all pending Up migrations in order.
func Migrate(db *gorm.DB) error {
	sv, err := ensureVersionTable(db)
	if err != nil {
		return err
	}

	current := sv.Version
	applied := 0

	for _, m := range migrations {
		if m.Version <= current {
			continue
		}
		log.Printf("Applying migration v%d: %s", m.Version, m.Description)
		if err := m.Up(db); err != nil {
			return fmt.Errorf("migration v%d (%s) failed: %w", m.Version, m.Description, err)
		}
		if err := db.Model(&sv).Update("version", m.Version).Error; err != nil {
			return fmt.Errorf("update schema_version to v%d: %w", m.Version, err)
		}
		sv.Version = m.Version
		applied++
	}

	if applied == 0 {
		log.Printf("Database schema up to date (v%d)", sv.Version)
	} else {
		log.Printf("Applied %d migration(s), schema now at v%d", applied, sv.Version)
	}
	return nil
}

// Rollback rolls back the most recent migration (one step down).
func Rollback(db *gorm.DB) error {
	sv, err := ensureVersionTable(db)
	if err != nil {
		return err
	}
	if sv.Version == 0 {
		log.Println("Nothing to roll back (already at v0)")
		return nil
	}

	// Find the migration matching current version
	var target *Migration
	var prevVersion int
	for i, m := range migrations {
		if m.Version == sv.Version {
			target = &migrations[i]
			if i > 0 {
				prevVersion = migrations[i-1].Version
			}
			break
		}
	}
	if target == nil {
		return fmt.Errorf("no migration found for current version v%d", sv.Version)
	}
	if target.Down == nil {
		return fmt.Errorf("migration v%d (%s) has no Down — cannot roll back", target.Version, target.Description)
	}

	log.Printf("Rolling back migration v%d: %s", target.Version, target.Description)
	if err := target.Down(db); err != nil {
		return fmt.Errorf("rollback v%d failed: %w", target.Version, err)
	}
	if err := db.Model(&sv).Update("version", prevVersion).Error; err != nil {
		return fmt.Errorf("update schema_version to v%d: %w", prevVersion, err)
	}
	log.Printf("Rolled back to v%d", prevVersion)
	return nil
}
