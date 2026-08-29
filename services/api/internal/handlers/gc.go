package handlers

import (
	"context"
	"crypto/subtle"
	"fmt"
	"os"
	"time"

	"aether-server/internal/db"
	"aether-server/internal/filestore"
	"aether-server/internal/models"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gofiber/fiber/v2"
)

// RunGarbageCollection cleans up pending shards older than 24 hours.
// It also cleans up any associated R2 backups to avoid orphaned objects.
func RunGarbageCollection() (int64, error) {
	threshold := time.Now().Add(-24 * time.Hour)

	var pendingShards []models.Shard
	if err := db.DB.Where("status = ? AND created_at < ?", "pending", threshold).Find(&pendingShards).Error; err != nil {
		return 0, fmt.Errorf("failed to query pending shards: %v", err)
	}

	var deletedCount int64 = 0
	for _, shard := range pendingShards {
		// 1. Delete associated R2 backup if it exists
		var backup models.ShardBackup
		if err := db.DB.Where("shard_id = ?", shard.ID).First(&backup).Error; err == nil {
			if filestore.S3Client != nil && filestore.BucketName != "" {
				_, s3Err := filestore.S3Client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
					Bucket: aws.String(filestore.BucketName),
					Key:    aws.String(backup.ObjectKey),
				})
				if s3Err != nil {
					fmt.Printf("Warning: Failed to delete R2 backup key %q during GC: %v\n", backup.ObjectKey, s3Err)
				}
			}
			// Delete database entry for backup
			db.DB.Delete(&backup)
		}

		// 2. Delete the pending shard record
		if err := db.DB.Delete(&shard).Error; err != nil {
			fmt.Printf("Warning: Failed to delete pending shard %d during GC: %v\n", shard.ID, err)
		} else {
			deletedCount++
		}
	}

	return deletedCount, nil
}

// GCHandler triggers garbage collection manually
func GCHandler(c *fiber.Ctx) error {
	secret := os.Getenv("ADMIN_SECRET")
	if secret == "" || subtle.ConstantTimeCompare([]byte(secret), []byte(c.Get("X-Admin-Secret"))) != 1 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	deletedCount, err := RunGarbageCollection()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"status":        "success",
		"deletedShards": deletedCount,
	})
}
