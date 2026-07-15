package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"

	"aether-server/internal/db"
	"aether-server/internal/models"
	"aether-server/internal/temporal"
	"github.com/gofiber/fiber/v2"
	"go.temporal.io/sdk/client"
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

type ChunkAllocationResponse struct {
	DataShards   int                       `json:"dataShards"`
	ParityShards int                       `json:"parityShards"`
	Allocations  []ShardAllocationResponse `json:"allocations"`
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

	var chunk models.Chunk
	result := db.DB.Where("file_version_id = ? AND chunk_index = ?", req.FileVersionID, req.ChunkIndex).First(&chunk)

	var userProviders []models.UserProvider
	db.DB.Where("user_id = ?", userID).Find(&userProviders)

	if len(userProviders) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No storage providers linked. Please link a provider to upload files."})
	}

	if result.Error == gorm.ErrRecordNotFound {
		// New chunk! Calculate dynamic math
		chunk.DataShards = 10
		chunk.ParityShards = 4

		chunk.FileVersionID = req.FileVersionID
		chunk.ChunkIndex = req.ChunkIndex
		chunk.Size = int64(req.ChunkSize)
		
		if err := db.DB.Create(&chunk).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create chunk"})
		}
	} else if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to allocate chunk"})
	}

	// Fallback for legacy chunks that were created before dynamic math
	if chunk.DataShards == 0 {
		chunk.DataShards = 10
		chunk.ParityShards = 4
	}

	// Find existing healthy shards to avoid duplicating them on retry
	var healthyShards []models.Shard
	db.DB.Where("chunk_id = ? AND status = ?", chunk.ID, "healthy").Find(&healthyShards)
	
	healthyMap := make(map[int]bool)
	for _, s := range healthyShards {
		healthyMap[s.ShardIndex] = true
	}

	// Delete existing pending/failed shards for this chunk to prevent duplicates on retry
	db.DB.Where("chunk_id = ? AND status != ?", chunk.ID, "healthy").Delete(&models.Shard{})

	totalShards := chunk.DataShards + chunk.ParityShards
	shards := make([]models.Shard, 0, totalShards)

	for i := 0; i < totalShards; i++ {
		if healthyMap[i] {
			continue // Skip already healthy shards!
		}

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

	if len(shards) > 0 {
		if result := db.DB.Create(&shards); result.Error != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to allocate shards"})
		}
	}

	allocations := make([]ShardAllocationResponse, 0, totalShards)
	
	// Add the healthy ones to the response so the frontend knows they exist (even though they don't need re-uploading, wait, frontend expects all allocations. Actually frontend loops through encoded shards.)
	for _, shard := range healthyShards {
		allocations = append(allocations, ShardAllocationResponse{
			ShardID:    shard.ID,
			ShardIndex: shard.ShardIndex,
			Provider:   shard.Provider,
		})
	}
	
	for _, shard := range shards {
		allocations = append(allocations, ShardAllocationResponse{
			ShardID:    shard.ID,
			ShardIndex: shard.ShardIndex,
			Provider:   shard.Provider,
		})
	}

	return c.JSON(fiber.Map{
		"allocation": ChunkAllocationResponse{
			DataShards:   chunk.DataShards,
			ParityShards: chunk.ParityShards,
			Allocations:  allocations,
		},
	})
}

func UploadShardHandler(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	// 1. True Streaming: Parse multipart boundaries without buffering
	boundary := c.Request().Header.MultipartFormBoundary()
	if len(boundary) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Missing multipart boundary"})
	}

	var multipartReader *multipart.Reader

	bodyStream := c.Context().RequestBodyStream()
	if bodyStream != nil {
		// VERY IMPORTANT: Drain any remaining bytes in the stream when the handler returns.
		// If fasthttp's RequestBodyStream is not drained to EOF, it abruptly kills the TCP socket (ECONNRESET)!
		defer io.Copy(io.Discard, bodyStream)
		multipartReader = multipart.NewReader(bodyStream, string(boundary))
	} else {
		// If fasthttp buffered the request (e.g., due to Content-Length being present),
		// we can gracefully fall back to reading from memory.
		bodyBytes := c.Body()
		if len(bodyBytes) == 0 {
			return c.Status(400).JSON(fiber.Map{"error": "Request body is empty"})
		}
		multipartReader = multipart.NewReader(bytes.NewReader(bodyBytes), string(boundary))
	}

	var shardIDStr string
	var fileStream io.Reader
	var shard models.Shard
	var user models.User

	if err := db.DB.First(&user, userID).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "User not found"})
	}

	// 2. Iterate parts sequentially
	for {
		part, err := multipartReader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Failed reading multipart body"})
		}

		if part.FormName() == "shardId" {
			buf, _ := io.ReadAll(part)
			shardIDStr = string(buf)

			// Load the shard allocation now that we have the ID
			if err := shardQueryForUser(userID).Where("shards.id = ?", shardIDStr).First(&shard).Error; err != nil {
				return c.Status(404).JSON(fiber.Map{"error": "Shard allocation not found"})
			}
		} else if part.FormName() == "file" {
			if shardIDStr == "" {
				return c.Status(400).JSON(fiber.Map{"error": "shardId must be sent before the file stream"})
			}
			fileStream = part

			// Now we have the active network stream. Let's upload immediately.
			provider, cfg, err := ResolveProvider(shard.Provider)
			if err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Unsupported provider"})
			}

			var providerFileID string
			var uploadErr error

			// 4. Stream to Primary Provider
			// Note: We cannot retry a True Stream because the bytes are gone once read.
			// The browser will have to retry the upload if it fails.
			providerFileID, uploadErr = provider.UploadShard(fmt.Sprintf("%d", shard.ID), fileStream, cfg)

			// Check if the shard was deleted from the DB (i.e. frontend aborted upload)
			var checkShard models.Shard
			if dbErr := db.DB.First(&checkShard, shard.ID).Error; dbErr != nil {
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

			// 5. Trigger Temporal Asynchronous Backup if applicable
			if user.IsPremium && user.R2BackupEnabled && temporal.Client != nil {
				workflowOptions := client.StartWorkflowOptions{
					ID:        fmt.Sprintf("backup-shard-%d", shard.ID),
					TaskQueue: "AETHER_BACKUP_QUEUE",
				}
				
				backupArgs := UploadBackupArgs{
					UserID:  userID,
					ShardID: shard.ID,
				}
				
				_, err := temporal.Client.ExecuteWorkflow(context.Background(), workflowOptions, BackupShardWorkflow, backupArgs)
				if err != nil {
					fmt.Printf("Warning: Failed to enqueue Temporal backup workflow for shard %d: %v\n", shard.ID, err)
				} else {
					fmt.Printf("Temporal workflow BackupShardWorkflow started for shard %d\n", shard.ID)
				}
			}

			// Update shard status on success
			checkShard.ProviderFileID = providerFileID
			checkShard.Status = "healthy"
			db.DB.Save(&checkShard)

			// VERY IMPORTANT: Drain the rest of the multipart stream (trailing boundaries)
			// If we don't drain it, fasthttp detects an unread body and closes the TCP connection abruptly (ECONNRESET)!
			if bodyStream != nil {
				io.Copy(io.Discard, bodyStream)
			}

			return c.JSON(fiber.Map{"message": "Shard uploaded successfully", "providerFileId": providerFileID})
		}
	}

	return c.Status(400).JSON(fiber.Map{"error": "Missing file payload"})
}

// UploadChunkBatchHandler has been deleted in favor of True Streaming parallel single-shard uploads.

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
