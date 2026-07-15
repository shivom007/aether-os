package db

import (
	"log"

	"os"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"aether-server/internal/models"
)

var DB *gorm.DB

func InitDB() {
	var err error
	
	// Check if we are running in Railway with a Postgres database
	databaseURL := os.Getenv("DATABASE_URL")

	if databaseURL != "" {
		log.Println("Detected DATABASE_URL. Connecting to PostgreSQL...")
		DB, err = gorm.Open(postgres.Open(databaseURL), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
	} else {
		log.Println("No DATABASE_URL found. Falling back to local pure-Go SQLite...")
		DB, err = gorm.Open(sqlite.Open("aether.db"), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
	}
	
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Database connection established. Running migrations...")

	// Auto-migrate the schema
	err = DB.AutoMigrate(
		&models.User{},
		&models.Volume{},
		&models.Folder{},
		&models.File{},
		&models.FileVersion{},
		&models.Chunk{},
		&models.Shard{},
		&models.UserProvider{},
		&models.OAuthSession{},
		&models.ShardBackup{},
	)
	
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	// Backwards compatibility migration:
	// Set default shard math (10 Data, 4 Parity) for any chunks created before True Dynamic Sharding was implemented.
	DB.Model(&models.Chunk{}).Where("data_shards = ? OR data_shards IS NULL", 0).Updates(map[string]interface{}{
		"data_shards":   10,
		"parity_shards": 4,
	})

	log.Println("Database migration completed successfully.")
}
