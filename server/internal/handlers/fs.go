package handlers

import (
	"context"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"aether-server/internal/db"
	"aether-server/internal/models"
	"aether-server/internal/filestore"
)

type CreateFolderRequest struct {
	Name     string `json:"name"`
	ParentID *uint  `json:"parentId"` // null if root
	VolumeID string `json:"volumeId"`
}

type FileMetadataRequest struct {
	Name      string `json:"name"`
	FolderID  *uint  `json:"folderId"`
	VolumeID  string `json:"volumeId"`
	Size      int64  `json:"size"`
	MimeType  string `json:"mimeType"`
	Thumbnail string `json:"thumbnail,omitempty"`
}

// Get userID from JWT middleware context
func getUserID(c *fiber.Ctx) uint {
	authHeader := c.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return 0
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil // jwtSecret is shared from auth.go in the handlers package
	})

	if err != nil {
		fmt.Println("jwt.Parse error:", err)
		return 0
	}
	if !token.Valid {
		fmt.Println("token not valid")
		return 0
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0
	}

	idFloat, ok := claims["user_id"].(float64)
	if !ok {
		return 0
	}
	return uint(idFloat)
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

	file := models.File{
		Name:      req.Name,
		FolderID:  req.FolderID,
		VolumeID:  req.VolumeID,
		Size:      req.Size,
		MimeType:  req.MimeType,
		Thumbnail: "", // We will set this if S3 upload succeeds
		UserID:    userID,
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
		"file": file,
		"versionId": fileVersion.ID,
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

	// Physically delete shards from providers

	// Delete DB records synchronously to update UI instantly
	for _, version := range file.Versions {
		for _, chunk := range version.Chunks {
			for _, shard := range chunk.Shards {
				db.DB.Delete(&shard)
			}
			db.DB.Delete(&chunk)
		}
		db.DB.Delete(&version)
	}
	db.DB.Delete(&file)

	// Run physical provider deletion in a background goroutine
	go func(file models.File) {
		for _, version := range file.Versions {
			for _, chunk := range version.Chunks {
				for _, shard := range chunk.Shards {
					if provider, cfg, err := ResolveProvider(shard.Provider); err == nil {
						// Attempt physical delete (ignore errors)
						provider.DeleteShard(shard.ProviderFileID, cfg)
					}
				}
			}
		}
		
		// Delete S3 thumbnail if it exists
		if strings.HasPrefix(file.Thumbnail, "thumbnails/") {
			filestore.DeleteThumbnail(context.Background(), file.Thumbnail)
		}
	}(file)

	return c.JSON(fiber.Map{"message": "File deleted successfully"})
}
