package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"aether-server/internal/db"
	"aether-server/internal/handlers"
	"aether-server/internal/filestore"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load() // Loads .env if it exists

	// Initialize Database and run migrations
	db.InitDB()

	// Initialize S3 Storage for Thumbnails
	filestore.InitS3()

	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		AppName:   "Aether Metadata Service",
		BodyLimit: 500 * 1024 * 1024, // 500 MB limit
	})

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*", // For development MVP
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
	api.Post("/auth/login", handlers.Login)
	
	// File system routes
	api.Get("/fs", handlers.ListFiles)
	api.Post("/fs/folder", handlers.CreateFolder)
	api.Post("/fs/file", handlers.RegisterFile)
	api.Get("/fs/file/:id", handlers.GetFileDetails)
	api.Delete("/fs/file/:id", handlers.DeleteFile)
	
	// Providers
	api.Get("/providers", handlers.ListProviders)
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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting Aether server on :%s...", port)
	log.Fatal(app.Listen(":" + port))
}
