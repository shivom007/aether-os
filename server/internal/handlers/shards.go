package handlers

import (
	"fmt"
	"mime/multipart"
	"strconv"
	"strings"
	"time"

	"aether-server/internal/db"
	"aether-server/internal/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
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
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req AllocateShardRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var fileVersion models.FileVersion
	if err := db.DB.Model(&models.FileVersion{}).
		Joins("JOIN files ON files.id = file_versions.file_id").
		Where("file_versions.id = ? AND files.user_id = ?", req.FileVersionID, userID).
		First(&fileVersion).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "File version not found"})
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

	var userProviders []models.UserProvider
	db.DB.Where("user_id = ?", userID).Find(&userProviders)

	if len(userProviders) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No storage providers linked. Please link a provider to upload files."})
	}

	shards := make([]models.Shard, 0, 14)

	for i := 0; i < 14; i++ {
		p := userProviders[i%len(userProviders)]
		providerName := fmt.Sprintf("UserProvider_%d", p.ID)

		shards = append(shards, models.Shard{
			ChunkID:        chunk.ID,
			ShardIndex:     i,
			Provider:       providerName,
			ProviderFileID: "pending", // To be updated once client uploads it
			Status:         "pending", // Wait for upload
		})
	}

	if result := db.DB.Create(&shards); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to allocate shards"})
	}

	allocations := make([]ShardAllocationResponse, 0, len(shards))
	for _, shard := range shards {
		allocations = append(allocations, ShardAllocationResponse{
			ShardID:    shard.ID,
			ShardIndex: shard.ShardIndex,
			Provider:   shard.Provider,
		})
	}

	return c.Status(201).JSON(fiber.Map{
		"chunkId":     chunk.ID,
		"allocations": allocations,
	})
}

func UploadShardHandler(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	shardIDStr := c.FormValue("shardId")
	if shardIDStr == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Missing shardId form value"})
	}

	var shard models.Shard
	if err := shardQueryForUser(userID).Where("shards.id = ?", shardIDStr).First(&shard).Error; err != nil {
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
				fmt.Printf("Rate limit hit on shard %d (attempt %d). Retrying in 1.5s...\n", shard.ID, attempt)
				time.Sleep(1500 * time.Millisecond)
				continue
			}
		}
		// Other error or exhausted retries
		break
	}

	// Check if the shard was deleted from the DB (i.e. frontend aborted upload and called DeleteInode)
	var checkShard models.Shard
	if dbErr := db.DB.First(&checkShard, shard.ID).Error; dbErr != nil {
		// Shard was deleted! The upload was aborted.
		// Prevent orphan file leak by immediately deleting the file we just uploaded
		if providerFileID != "" && providerFileID != "pending" {
			provider.DeleteShard(providerFileID, cfg)
		}
		return c.Status(400).JSON(fiber.Map{"error": "Upload aborted"})
	}

	if uploadErr != nil {
		fmt.Printf("Provider UploadShard failed for %s: %v\n", shard.Provider, uploadErr)
		checkShard.Status = "missing"
		db.DB.Save(&checkShard)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to upload to provider"})
	}

	// Update shard status on success
	checkShard.ProviderFileID = providerFileID
	checkShard.Status = "healthy"
	db.DB.Save(&checkShard)

	return c.JSON(fiber.Map{"message": "Shard uploaded successfully", "providerFileId": providerFileID})
}

func UploadChunkBatchHandler(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Failed to parse multipart form"})
	}

	type PendingUpload struct {
		Index      int
		ShardID    uint
		FileHeader *multipart.FileHeader
	}

	type UploadResult struct {
		Index          int
		ShardID        uint
		Provider       string
		ProviderFileID string
		Error          error
	}

	pendingUploads := make([]PendingUpload, 0, 14)
	shardIDs := make([]uint, 0, 14)

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

		shardID, err := strconv.ParseUint(shardIDStrs[0], 10, 64)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid shard ID"})
		}

		pendingUploads = append(pendingUploads, PendingUpload{
			Index:      i,
			ShardID:    uint(shardID),
			FileHeader: files[0],
		})
		shardIDs = append(shardIDs, uint(shardID))
	}

	if len(pendingUploads) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No shard uploads found"})
	}

	var shards []models.Shard
	if err := shardQueryForUser(userID).Where("shards.id IN ?", shardIDs).Find(&shards).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load shard allocations"})
	}

	shardsByID := make(map[uint]models.Shard, len(shards))
	providerNames := make([]string, 0, len(shards))
	for _, shard := range shards {
		shardsByID[shard.ID] = shard
		providerNames = append(providerNames, shard.Provider)
	}

	for _, upload := range pendingUploads {
		if _, exists := shardsByID[upload.ShardID]; !exists {
			return c.Status(404).JSON(fiber.Map{"error": "Shard allocation not found"})
		}
	}

	resolvedProviders, err := ResolveProviders(providerNames)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Unsupported provider"})
	}

	results := make(chan UploadResult, len(pendingUploads))

	for _, upload := range pendingUploads {
		shard := shardsByID[upload.ShardID]
		resolved := resolvedProviders[shard.Provider]

		go func(index int, shard models.Shard, resolved ResolvedProvider, fh *multipart.FileHeader) {
			sem <- struct{}{}        // Acquire token
			defer func() { <-sem }() // Release token

			fileData, err := fh.Open()
			if err != nil {
				results <- UploadResult{Index: index, ShardID: shard.ID, Provider: shard.Provider, Error: err}
				return
			}
			defer fileData.Close()

			var providerFileID string
			var uploadErr error
			maxRetries := 3

			for attempt := 1; attempt <= maxRetries; attempt++ {
				// Seek to beginning before every attempt (vital for retries on a stream)
				fileData.Seek(0, 0)

				providerFileID, uploadErr = resolved.Provider.UploadShard(fmt.Sprintf("%d", shard.ID), fileData, resolved.Config)
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

			results <- UploadResult{
				Index:          index,
				ShardID:        shard.ID,
				Provider:       shard.Provider,
				ProviderFileID: providerFileID,
				Error:          uploadErr,
			}
		}(upload.Index, shard, resolved, upload.FileHeader)
	}

	// Wait for all goroutines to finish
	var hasError bool
	uploadResults := make([]UploadResult, 0, len(pendingUploads))
	for i := 0; i < len(pendingUploads); i++ {
		res := <-results
		uploadResults = append(uploadResults, res)
		if res.Error != nil {
			fmt.Printf("Batch upload error on shard index %d: %v\n", res.Index, res.Error)
			hasError = true
		}
	}

	var existingShards []models.Shard
	if err := db.DB.Select("id").Where("id IN ?", shardIDs).Find(&existingShards).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to verify shard uploads"})
	}

	existingShardIDs := make(map[uint]bool, len(existingShards))
	for _, shard := range existingShards {
		existingShardIDs[shard.ID] = true
	}

	successfulUploads := make(map[uint]string)
	var failedShardIDs []uint
	for _, res := range uploadResults {
		if !existingShardIDs[res.ShardID] {
			if res.ProviderFileID != "" && res.ProviderFileID != "pending" {
				if resolved, ok := resolvedProviders[res.Provider]; ok {
					resolved.Provider.DeleteShard(res.ProviderFileID, resolved.Config)
				}
			}
			hasError = true
			continue
		}

		if res.Error != nil {
			failedShardIDs = append(failedShardIDs, res.ShardID)
			continue
		}
		successfulUploads[res.ShardID] = res.ProviderFileID
	}

	if len(failedShardIDs) > 0 {
		db.DB.Model(&models.Shard{}).Where("id IN ?", failedShardIDs).Update("status", "missing")
	}
	if len(successfulUploads) > 0 {
		if err := batchMarkShardsHealthy(successfulUploads); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update shard statuses"})
		}
	}

	if hasError {
		return c.Status(500).JSON(fiber.Map{"error": "One or more shards failed to upload"})
	}

	return c.JSON(fiber.Map{"message": "Batch upload processed successfully"})
}

func DownloadShardHandler(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	shardIDStr := c.Params("id")

	var shard models.Shard
	if err := shardQueryForUser(userID).Where("shards.id = ?", shardIDStr).First(&shard).Error; err != nil {
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

func shardQueryForUser(userID uint) *gorm.DB {
	return db.DB.Model(&models.Shard{}).
		Joins("JOIN chunks ON chunks.id = shards.chunk_id").
		Joins("JOIN file_versions ON file_versions.id = chunks.file_version_id").
		Joins("JOIN files ON files.id = file_versions.file_id").
		Where("files.user_id = ?", userID)
}

func batchMarkShardsHealthy(providerFileIDs map[uint]string) error {
	shardIDs := make([]uint, 0, len(providerFileIDs))
	caseSQL := "CASE id "
	caseArgs := make([]interface{}, 0, len(providerFileIDs)*2)

	for shardID, providerFileID := range providerFileIDs {
		shardIDs = append(shardIDs, shardID)
		caseSQL += "WHEN ? THEN ? "
		caseArgs = append(caseArgs, shardID, providerFileID)
	}
	caseSQL += "END"

	return db.DB.Model(&models.Shard{}).
		Where("id IN ?", shardIDs).
		Updates(map[string]interface{}{
			"provider_file_id": gorm.Expr(caseSQL, caseArgs...),
			"status":           "healthy",
		}).Error
}
