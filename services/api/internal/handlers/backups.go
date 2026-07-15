package handlers

import (
	"context"
	"fmt"
	"io"
	"time"

	"aether-server/internal/db"
	"aether-server/internal/filestore"
	"aether-server/internal/models"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// UploadBackupArgs contains parameters for the backup activity.
type UploadBackupArgs struct {
	UserID  uint
	ShardID uint
}

// UploadBackupActivity downloads a shard from the primary provider and uploads it to R2.
func UploadBackupActivity(ctx context.Context, args UploadBackupArgs) error {
	// 1. Fetch shard from database
	var shard models.Shard
	if err := db.DB.First(&shard, args.ShardID).Error; err != nil {
		return fmt.Errorf("shard %d not found in database: %w", args.ShardID, err)
	}

	if shard.Status != "healthy" {
		return fmt.Errorf("shard %d is not healthy (status: %s), skipping backup", args.ShardID, shard.Status)
	}

	// 2. Resolve primary provider
	provider, cfg, err := ResolveProvider(shard.Provider)
	if err != nil {
		return fmt.Errorf("failed to resolve provider %s: %w", shard.Provider, err)
	}

	// 3. Download the shard from the primary provider
	stream, err := provider.DownloadShard(shard.ProviderFileID, cfg)
	if err != nil {
		return fmt.Errorf("failed to download shard %d from %s: %w", args.ShardID, shard.Provider, err)
	}
	defer func() {
		if closer, ok := stream.(io.ReadCloser); ok {
			closer.Close()
		}
	}()

	// 4. Upload to Cloudflare R2
	r2ObjectKey := fmt.Sprintf("backups/user_%d/shard_%d.enc", args.UserID, args.ShardID)

	_, err = filestore.S3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(filestore.BucketName),
		Key:         aws.String(r2ObjectKey),
		Body:        stream,
		ContentType: aws.String("application/octet-stream"),
	})

	if err != nil {
		return fmt.Errorf("failed to upload shard %d to R2: %w", args.ShardID, err)
	}

	// 5. Log the backup in the database
	backupRecord := models.ShardBackup{
		ShardID:   shard.ID,
		ObjectKey: r2ObjectKey,
	}

	// Use FirstOrCreate to avoid duplicate unique key errors on retries
	if err := db.DB.Where(models.ShardBackup{ShardID: shard.ID}).FirstOrCreate(&backupRecord).Error; err != nil {
		return fmt.Errorf("failed to save shard backup record: %w", err)
	}

	return nil
}

// BackupShardWorkflow handles the reliable execution of the R2 backup task.
func BackupShardWorkflow(ctx workflow.Context, args UploadBackupArgs) error {
	// Retry policy: Retry on failures (e.g., rate limits, network timeouts)
	retryPolicy := &temporal.RetryPolicy{
		InitialInterval:    time.Second * 5,
		BackoffCoefficient: 2.0,
		MaximumInterval:    time.Minute * 5,
		MaximumAttempts:    10, // Try 10 times before giving up
	}

	options := workflow.ActivityOptions{
		StartToCloseTimeout: time.Minute * 10, // A shard download/upload could take minutes
		RetryPolicy:         retryPolicy,
	}
	ctx = workflow.WithActivityOptions(ctx, options)

	err := workflow.ExecuteActivity(ctx, UploadBackupActivity, args).Get(ctx, nil)
	if err != nil {
		return err
	}

	return nil
}
