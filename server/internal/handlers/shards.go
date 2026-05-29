package handlers

import (
	"fmt"
	"mime/multipart"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"aether-server/internal/db"
	"aether-server/internal/models"
)

type AllocateShardRequest struct {
	FileVersionID uint  `json:"fileVersionId"`
	ChunkIndex    int   `json:"chunkIndex"`
	ChunkSize     int64 `json:"chunkSize"`
}

type ShardAllocationResponse struct {
	ShardID    uint   `json:"shardId"`
	ShardIndex int    `json:"shardIndex"`
	Provider   string `json:"provider"` // e.g., GoogleDrive, Dropbox
}

// Providers available in MVP
var availableProviders = []string{"GoogleDrive", "Dropbox"}

func AllocateShards(c *fiber.Ctx) error {
	var req AllocateShardRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Look up chunk or create it if not exists
	chunk := models.Chunk{
		FileVersionID: req.FileVersionID,
		ChunkIndex:    req.ChunkIndex,
		Size:          int64(req.ChunkSize),
	}
	if err := db.DB.Where("file_version_id = ? AND chunk_index = ?", req.FileVersionID, req.ChunkIndex).
		FirstOrCreate(&chunk).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to allocate chunk"})
	}

	// Delete existing pending shards for this chunk to prevent duplicates on retry
	db.DB.Where("chunk_id = ? AND status = ?", chunk.ID, "pending").Delete(&models.Shard{})

	// Fetch User Providers
	userID := getUserID(c)
	var userProviders []models.UserProvider
	db.DB.Where("user_id = ?", userID).Find(&userProviders)

	if len(userProviders) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No storage providers linked. Please link a provider to upload files."})
	}

	var allocations []ShardAllocationResponse
	
	for i := 0; i < 14; i++ {
		p := userProviders[i%len(userProviders)]
		providerName := fmt.Sprintf("UserProvider_%d", p.ID)
		
		shard := models.Shard{
			ChunkID:        chunk.ID,
			ShardIndex:     i,
			Provider:       providerName,
			ProviderFileID: "pending", // To be updated once client uploads it
			Status:         "pending", // Wait for upload
		}
		if result := db.DB.Create(&shard); result.Error != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to allocate shard"})
		}

		allocations = append(allocations, ShardAllocationResponse{
			ShardID:    shard.ID,
			ShardIndex: i,
			Provider:   providerName,
		})
	}

	return c.Status(201).JSON(fiber.Map{
		"chunkId":     chunk.ID,
		"allocations": allocations,
	})
}

func UploadShardHandler(c *fiber.Ctx) error {
	shardIDStr := c.FormValue("shardId")
	if shardIDStr == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Missing shardId form value"})
	}

	var shard models.Shard
	if err := db.DB.First(&shard, shardIDStr).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Shard allocation not found"})
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Missing file upload"})
	}

	fileData, err := fileHeader.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read uploaded file"})
	}
	defer fileData.Close()

	// Look up provider in registry
	provider, cfg, err := ResolveProvider(shard.Provider)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Unsupported provider"})
	}

	// Dispatch to simulated cloud provider
	providerFileID, err := provider.UploadShard(fmt.Sprintf("%d", shard.ID), fileData, cfg)
	if err != nil {
		fmt.Printf("Provider UploadShard failed for %s: %v\n", shard.Provider, err)
		shard.Status = "missing"
		db.DB.Save(&shard)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to upload to provider"})
	}

	// Update shard status on success
	shard.ProviderFileID = providerFileID
	shard.Status = "healthy"
	db.DB.Save(&shard)

	return c.JSON(fiber.Map{"message": "Shard uploaded successfully", "providerFileId": providerFileID})
}

func UploadChunkBatchHandler(c *fiber.Ctx) error {
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Failed to parse multipart form"})
	}

	type UploadResult struct {
		Index int
		Error error
	}
	
	results := make(chan UploadResult, 14)
	var expectedUploads int

	// Semaphore to limit concurrent external provider requests to 8
	// This prevents rate limits like Dropbox's "too_many_write_operations"
	sem := make(chan struct{}, 8)

	for i := 0; i < 14; i++ {
		fileKey := fmt.Sprintf("shard_%d", i)
		idKey := fmt.Sprintf("shardId_%d", i)
		
		shardIDStrs, okId := form.Value[idKey]
		files, okFile := form.File[fileKey]
		
		if !okId || !okFile || len(shardIDStrs) == 0 || len(files) == 0 {
			continue 
		}
		
		expectedUploads++
		shardIDStr := shardIDStrs[0]
		fileHeader := files[0]
		
		go func(index int, sID string, fh *multipart.FileHeader) {
			sem <- struct{}{}        // Acquire token
			defer func() { <-sem }() // Release token

			var shard models.Shard
			if err := db.DB.First(&shard, sID).Error; err != nil {
				results <- UploadResult{Index: index, Error: fmt.Errorf("shard not found")}
				return
			}

			fileData, err := fh.Open()
			if err != nil {
				results <- UploadResult{Index: index, Error: err}
				return
			}
			defer fileData.Close()

			provider, cfg, err := ResolveProvider(shard.Provider)
			if err != nil {
				results <- UploadResult{Index: index, Error: fmt.Errorf("unsupported provider")}
				return
			}

			var providerFileID string
			var uploadErr error
			maxRetries := 3

			for attempt := 1; attempt <= maxRetries; attempt++ {
				// Seek to beginning before every attempt (vital for retries on a stream)
				fileData.Seek(0, 0)
				
				providerFileID, uploadErr = provider.UploadShard(fmt.Sprintf("%d", shard.ID), fileData, cfg)
				if uploadErr == nil {
					break // Success
				}
				
				// Check if it's a Dropbox rate limit error
				if strings.Contains(uploadErr.Error(), "too_many_write_operations") {
					if attempt < maxRetries {
						fmt.Printf("Rate limit hit on shard %d (attempt %d). Retrying in 1.5s...\n", index, attempt)
						time.Sleep(1500 * time.Millisecond)
						continue
					}
				}
				// Other error or exhausted retries
				break
			}

			if uploadErr != nil {
				shard.Status = "missing"
				db.DB.Save(&shard)
				results <- UploadResult{Index: index, Error: uploadErr}
				return
			}

			shard.ProviderFileID = providerFileID
			shard.Status = "healthy"
			db.DB.Save(&shard)

			results <- UploadResult{Index: index, Error: nil}
		}(i, shardIDStr, fileHeader)
	}
	
	// Wait for all goroutines to finish
	var hasError bool
	for i := 0; i < expectedUploads; i++ {
		res := <-results
		if res.Error != nil {
			fmt.Printf("Batch upload error on shard index %d: %v\n", res.Index, res.Error)
			hasError = true
		}
	}

	if hasError {
		return c.Status(500).JSON(fiber.Map{"error": "One or more shards failed to upload"})
	}

	return c.JSON(fiber.Map{"message": "Batch upload processed successfully"})
}

func DownloadShardHandler(c *fiber.Ctx) error {
	shardIDStr := c.Params("id")
	
	var shard models.Shard
	if err := db.DB.First(&shard, shardIDStr).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Shard not found"})
	}

	provider, cfg, err := ResolveProvider(shard.Provider)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Provider resolution failed"})
	}

	reader, err := provider.DownloadShard(shard.ProviderFileID, cfg)
	if err != nil {
		fmt.Printf("DownloadShard failed for shard %s (provider %s): %v\n", shardIDStr, shard.Provider, err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to download shard from provider"})
	}

	c.Set("Content-Type", "application/octet-stream")
	return c.SendStream(reader)
}
