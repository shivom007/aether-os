package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"aether-server/internal/db"
	"aether-server/internal/filestore"
	"aether-server/internal/models"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type CreateFolderRequest struct {
	Name     string `json:"name"`
	ParentID *uint  `json:"parentId"` // null if root
	VolumeID string `json:"volumeId"`
}

type FileMetadataRequest struct {
	Name          string `json:"name"`
	FolderID      *uint  `json:"folderId"`
	VolumeID      string `json:"volumeId"`
	Size          int64  `json:"size"`
	MimeType      string `json:"mimeType"`
	Thumbnail     string `json:"thumbnail,omitempty"`
	Fingerprint   string `json:"fingerprint,omitempty"`
	MediaMetadata string `json:"mediaMetadata,omitempty"`
}

type UpdateFileMediaMetadataRequest struct {
	MediaMetadata string `json:"mediaMetadata"`
}

// Get userID from JWT middleware context
func getUserID(c *fiber.Ctx) uint {
	authHeader := c.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return 0
	}
	return authenticateBearerToken(strings.TrimPrefix(authHeader, "Bearer "))
}

func ensureVolumeOwnership(userID uint, volumeID string) error {
	if volumeID == "" {
		return fmt.Errorf("volumeId is required")
	}

	var volume models.Volume
	if err := db.DB.Where("id = ? AND user_id = ?", volumeID, userID).First(&volume).Error; err != nil {
		return fmt.Errorf("volume not found")
	}
	return nil
}

func ensureFolderOwnership(userID uint, volumeID string, folderID *uint) error {
	if folderID == nil {
		return nil
	}

	var folder models.Folder
	if err := db.DB.Where("id = ? AND user_id = ? AND volume_id = ?", *folderID, userID, volumeID).First(&folder).Error; err != nil {
		return fmt.Errorf("folder not found")
	}
	return nil
}

func CreateFolder(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req CreateFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if err := ensureVolumeOwnership(userID, req.VolumeID); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	if err := ensureFolderOwnership(userID, req.VolumeID, req.ParentID); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}

	folder := models.Folder{
		Name:     req.Name,
		ParentID: req.ParentID,
		UserID:   userID,
		VolumeID: req.VolumeID,
	}

	if result := db.DB.Create(&folder); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create folder"})
	}

	return c.Status(201).JSON(folder)
}

func DeleteFolder(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	folderID := c.Params("id")
	var folder models.Folder
	if err := db.DB.Where("id = ? AND user_id = ?", folderID, userID).First(&folder).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Folder not found"})
	}

	var childFolders int64
	if err := db.DB.Model(&models.Folder{}).Where("parent_id = ? AND user_id = ?", folder.ID, userID).Count(&childFolders).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to check folder contents"})
	}
	var childFiles int64
	if err := db.DB.Model(&models.File{}).Where("folder_id = ? AND user_id = ?", folder.ID, userID).Count(&childFiles).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to check folder contents"})
	}
	if childFolders > 0 || childFiles > 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Folder is not empty"})
	}

	if err := db.DB.Delete(&folder).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete folder"})
	}
	return c.JSON(fiber.Map{"message": "Folder deleted successfully"})
}

func ListFiles(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	parentID := c.QueryInt("parentId", -1)

	var folders []models.Folder
	var files []models.File

	volumeID := c.Query("volumeId")

	folderQuery := db.DB.Where("user_id = ?", userID)
	fileQuery := db.DB.Where("user_id = ?", userID)

	if volumeID != "" {
		folderQuery = folderQuery.Where("volume_id = ?", volumeID)
		fileQuery = fileQuery.Where("volume_id = ?", volumeID)
	}

	if parentID == -1 {
		folderQuery = folderQuery.Where("parent_id IS NULL")
		fileQuery = fileQuery.Where("folder_id IS NULL")
	} else {
		folderQuery = folderQuery.Where("parent_id = ?", parentID)
		fileQuery = fileQuery.Where("folder_id = ?", parentID)
	}

	folderQuery.Find(&folders)
	fileQuery.Find(&files)

	for i := range files {
		if strings.HasPrefix(files[i].Thumbnail, "thumbnails/") && filestore.PresignClient != nil {
			url, err := filestore.GeneratePresignedURL(c.Context(), files[i].Thumbnail)
			if err == nil {
				files[i].Thumbnail = url
			}
		}
	}

	return c.JSON(fiber.Map{
		"folders": folders,
		"files":   files,
	})
}

func RegisterFile(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req FileMetadataRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if err := ensureVolumeOwnership(userID, req.VolumeID); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	if err := ensureFolderOwnership(userID, req.VolumeID, req.FolderID); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}

	// SECURITY: Hard server-side limit of 1GB to match the frontend video limit.
	// This prevents malicious users from exhausting database rows via shard allocations.
	const maxServerSize = 1 * 1024 * 1024 * 1024 // 1 GB
	if req.Size > maxServerSize {
		return c.Status(400).JSON(fiber.Map{"error": "File size exceeds the absolute server limit of 1GB"})
	}
	if err := validateMediaMetadata(req.MediaMetadata); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	// RESUMABLE UPLOADS: Check if file already exists with this fingerprint
	if req.Fingerprint != "" {
		var existingFile models.File
		if err := db.DB.Preload("Versions.Chunks.Shards").
			Where("fingerprint = ? AND user_id = ? AND volume_id = ?", req.Fingerprint, userID, req.VolumeID).
			First(&existingFile).Error; err == nil {

			completedChunks := make([]int, 0)
			if len(existingFile.Versions) > 0 {
				latestVer := existingFile.Versions[len(existingFile.Versions)-1]
				for _, chunk := range latestVer.Chunks {
					if len(chunk.Shards) == 14 {
						completedChunks = append(completedChunks, chunk.ChunkIndex)
					}
				}

				return c.Status(200).JSON(fiber.Map{
					"file":            existingFile,
					"versionId":       latestVer.ID,
					"completedChunks": completedChunks,
				})
			}
		}
	}

	file := models.File{
		Name:          req.Name,
		FolderID:      req.FolderID,
		VolumeID:      req.VolumeID,
		Size:          req.Size,
		MimeType:      req.MimeType,
		Thumbnail:     "",
		Fingerprint:   req.Fingerprint,
		MediaMetadata: req.MediaMetadata,
		UserID:        userID,
	}

	if result := db.DB.Create(&file); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not register file metadata"})
	}

	if req.Thumbnail != "" {
		// The frontend sends "ivBase64:ciphertextBase64", which is just an ASCII string.
		// We shouldn't base64 decode it here because the colon makes it invalid base64.
		// We just store the raw string bytes in S3!
		thumbnailBytes := []byte(req.Thumbnail)

		if filestore.S3Client != nil {
			key := fmt.Sprintf("thumbnails/%d/%d.enc", userID, file.ID)
			err := filestore.UploadThumbnail(c.Context(), key, thumbnailBytes)
			if err == nil {
				file.Thumbnail = key
				db.DB.Save(&file)
			} else {
				fmt.Println("S3 upload failed:", err)
				// Fallback to storing in DB
				file.Thumbnail = req.Thumbnail
				db.DB.Save(&file)
			}
		} else {
			// Fallback if S3 not configured
			file.Thumbnail = req.Thumbnail
			db.DB.Save(&file)
		}
	}

	// Create initial FileVersion
	fileVersion := models.FileVersion{
		FileID:  file.ID,
		Version: 1,
		Size:    req.Size,
	}
	db.DB.Create(&fileVersion)

	return c.Status(201).JSON(fiber.Map{
		"file":            file,
		"versionId":       fileVersion.ID,
		"completedChunks": []int{},
	})
}

func GetFileDetails(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	fileID := c.Params("id")

	var file models.File
	if err := db.DB.Preload("Versions.Chunks.Shards").
		Where("id = ? AND user_id = ?", fileID, userID).
		First(&file).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "File not found"})
	}

	if strings.HasPrefix(file.Thumbnail, "thumbnails/") && filestore.PresignClient != nil {
		url, err := filestore.GeneratePresignedURL(c.Context(), file.Thumbnail)
		if err == nil {
			file.Thumbnail = url
		}
	}

	return c.JSON(file)
}

func UpdateFileMediaMetadata(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req UpdateFileMediaMetadataRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if err := validateMediaMetadata(req.MediaMetadata); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	var file models.File
	if err := db.DB.Where("id = ? AND user_id = ?", c.Params("id"), userID).First(&file).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "File not found"})
	}

	file.MediaMetadata = req.MediaMetadata
	if err := db.DB.Save(&file).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update media metadata"})
	}

	return c.JSON(file)
}

func validateMediaMetadata(value string) error {
	if value == "" {
		return nil
	}
	if len(value) > 16*1024 {
		return fmt.Errorf("mediaMetadata exceeds the 16KB limit")
	}
	if !json.Valid([]byte(value)) {
		return fmt.Errorf("mediaMetadata must be valid JSON")
	}
	return nil
}

func DeleteFile(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	fileID := c.Params("id")

	// Fetch entire hierarchy
	var file models.File
	if err := db.DB.Preload("Versions.Chunks.Shards").
		Where("id = ? AND user_id = ?", fileID, userID).
		First(&file).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "File not found"})
	}

	var versionIDs []uint
	var chunkIDs []uint
	var shardIDs []uint
	var providerNames []string
	for _, version := range file.Versions {
		versionIDs = append(versionIDs, version.ID)
		for _, chunk := range version.Chunks {
			chunkIDs = append(chunkIDs, chunk.ID)
			for _, shard := range chunk.Shards {
				shardIDs = append(shardIDs, shard.ID)
				providerNames = append(providerNames, shard.Provider)
			}
		}
	}

	var backupObjectKeys []string
	if len(shardIDs) > 0 {
		var backups []models.ShardBackup
		db.DB.Where("shard_id IN ?", shardIDs).Find(&backups)
		for _, b := range backups {
			backupObjectKeys = append(backupObjectKeys, b.ObjectKey)
		}
	}

	// Delete DB records synchronously to update UI instantly.
	if err := db.DB.Transaction(func(tx *gorm.DB) error {
		if len(shardIDs) > 0 {
			if err := tx.Where("shard_id IN ?", shardIDs).Delete(&models.ShardBackup{}).Error; err != nil {
				return err
			}
			if err := tx.Delete(&models.Shard{}, shardIDs).Error; err != nil {
				return err
			}
		}
		if len(chunkIDs) > 0 {
			if err := tx.Delete(&models.Chunk{}, chunkIDs).Error; err != nil {
				return err
			}
		}
		if len(versionIDs) > 0 {
			if err := tx.Delete(&models.FileVersion{}, versionIDs).Error; err != nil {
				return err
			}
		}
		return tx.Delete(&file).Error
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete file"})
	}

	// Run physical provider deletion in a background goroutine
	go func(file models.File, providerNames []string, backupObjectKeys []string) {
		resolvedProviders, err := ResolveProviders(providerNames)
		if err != nil {
			fmt.Println("ResolveProviders failed during file cleanup:", err)
		}

		for _, version := range file.Versions {
			for _, chunk := range version.Chunks {
				for _, shard := range chunk.Shards {
					resolved, ok := resolvedProviders[shard.Provider]
					if !ok {
						continue
					}
					// Attempt physical delete (ignore errors)
					resolved.Provider.DeleteShard(shard.ProviderFileID, resolved.Config)
				}
			}
		}

		// Delete R2 backups
		if filestore.S3Client != nil {
			for _, key := range backupObjectKeys {
				filestore.S3Client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
					Bucket: aws.String(filestore.BucketName),
					Key:    aws.String(key),
				})
			}
		}

		// Delete S3 thumbnail if it exists
		if strings.HasPrefix(file.Thumbnail, "thumbnails/") {
			filestore.DeleteThumbnail(context.Background(), file.Thumbnail)
		}
	}(file, providerNames, backupObjectKeys)

	return c.JSON(fiber.Map{"message": "File deleted successfully"})
}
