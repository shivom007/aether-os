package main

import (
	"log"
	"os"
	"time"

	"aether-server/internal/db"
	"aether-server/internal/filestore"
	"aether-server/internal/handlers"
	"aether-server/internal/temporal"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load() // Loads .env if it exists

	// Initialize Database and run migrations
	db.InitDB()

	// Initialize S3 Storage for Thumbnails
	filestore.InitS3()

	// Initialize Temporal Client
	if err := temporal.InitClient(); err != nil {
		log.Printf("Warning: Failed to initialize Temporal client. Async backups will be disabled: %v", err)
	} else {
		defer temporal.CloseClient()
	}

	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		AppName:           "Aether Metadata Service",
		BodyLimit:         500 * 1024 * 1024, // 500 MB limit
		StreamRequestBody: true,
	})

	// Middleware
	app.Use(logger.New())
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins: frontendURL,
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	// Basic health check route
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "message": "Aether API is running."})
	})

	// API Routes Group
	api := app.Group("/api/v1")

	// Auth routes
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "message": "Aether API v1 is running."})
	})
	api.Post("/auth/register", handlers.Register)
	api.Post("/auth/verify", handlers.Verify)
	api.Post("/auth/login", handlers.Login)
	api.Post("/auth/refresh", handlers.Refresh)
	api.Post("/auth/logout", handlers.Logout)

	// File system routes
	api.Get("/fs", handlers.ListFiles)
	api.Post("/fs/folder", handlers.CreateFolder)
	api.Delete("/fs/folder/:id", handlers.DeleteFolder)
	api.Post("/fs/file", handlers.RegisterFile)
	api.Get("/fs/file/:id", handlers.GetFileDetails)
	api.Delete("/fs/file/:id", handlers.DeleteFile)

	// Providers
	api.Get("/providers", handlers.ListProviders)
	api.Post("/providers/:id/health", handlers.CheckProviderHealth)
	api.Get("/providers/latency", handlers.ProviderLatency)
	api.Post("/providers/aws", handlers.LinkAWS)
	api.Delete("/providers/:id", handlers.UnlinkProvider)
	api.Post("/providers/oauth/session", handlers.CreateOAuthSession)
	api.Get("/providers/google/auth", handlers.GoogleAuth)
	api.Get("/providers/google/callback", handlers.GoogleCallback)
	api.Get("/providers/dropbox/auth", handlers.DropboxAuth)
	api.Get("/providers/dropbox/callback", handlers.DropboxCallback)

	// Shard Allocation route
	api.Post("/shards/allocate", handlers.AllocateShards)
	api.Post("/shards/upload", handlers.UploadShardHandler)
	api.Get("/shards/download/:id", handlers.DownloadShardHandler)

	// Volumes
	api.Get("/volumes", handlers.ListVolumes)
	api.Post("/volumes", handlers.CreateVolume)
	api.Patch("/volumes/:id", handlers.UpdateVolume)
	api.Delete("/volumes/:id", handlers.DeleteVolume)

	// Admin / Maintenance
	api.Post("/admin/gc", handlers.GCHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Start background Garbage Collection ticker (every 12 hours)
	go func() {
		ticker := time.NewTicker(12 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			log.Println("Starting background Garbage Collection...")
			count, err := handlers.RunGarbageCollection()
			if err != nil {
				log.Printf("Background Garbage Collection failed: %v", err)
			} else {
				log.Printf("Background Garbage Collection completed. Purged %d orphaned shards.", count)
			}
		}
	}()

	log.Printf("Starting Aether server on :%s...", port)
	log.Fatal(app.Listen(":" + port))
}
