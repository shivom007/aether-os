package temporal

import (
	"log"
	"os"

	"go.temporal.io/sdk/client"
)

var Client client.Client

// InitClient initializes the Temporal connection.
func InitClient() error {
	temporalAddress := os.Getenv("TEMPORAL_ADDRESS")
	if temporalAddress == "" {
		temporalAddress = "localhost:7233" // Default for local dev server
	}

	c, err := client.Dial(client.Options{
		HostPort: temporalAddress,
	})
	if err != nil {
		log.Printf("Failed to connect to Temporal: %v", err)
		return err
	}

	Client = c
	log.Println("Successfully connected to Temporal server.")
	return nil
}

// CloseClient cleanly closes the Temporal connection.
func CloseClient() {
	if Client != nil {
		Client.Close()
	}
}
