package main

import (
	"log"

	"aether-server/internal/db"
	"aether-server/internal/filestore"
	"aether-server/internal/handlers"
	"aether-server/internal/temporal"

	"github.com/joho/godotenv"
	"go.temporal.io/sdk/worker"
)

func main() {
	godotenv.Load() // Loads .env if it exists

	// Initialize Database and S3
	db.InitDB()
	filestore.InitS3()

	// Initialize Temporal Client
	if err := temporal.InitClient(); err != nil {
		log.Fatalf("Fatal: Failed to initialize Temporal client for worker: %v", err)
	}
	defer temporal.CloseClient()

	// Create the worker that listens on our specific Task Queue
	w := worker.New(temporal.Client, "AETHER_BACKUP_QUEUE", worker.Options{})

	// Register workflows and activities
	w.RegisterWorkflow(handlers.BackupShardWorkflow)
	w.RegisterActivity(handlers.UploadBackupActivity)

	log.Println("Starting Aether Temporal Worker...")
	
	// Start listening to the Task Queue
	err := w.Run(worker.InterruptCh())
	if err != nil {
		log.Fatalf("Fatal: Worker run failed: %v", err)
	}
	
	log.Println("Worker stopped safely.")
}
