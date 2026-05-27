package storage

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

var (
	S3Client      *s3.Client
	PresignClient *s3.PresignClient
	BucketName    string
)

func InitS3() error {
	endpoint := os.Getenv("R2_ENDPOINT")
	accessKey := os.Getenv("R2_ACCESS_KEY_ID")
	secretKey := os.Getenv("R2_SECRET_ACCESS_KEY")
	BucketName = os.Getenv("R2_BUCKET_NAME")

	if endpoint == "" || accessKey == "" || secretKey == "" || BucketName == "" {
		log.Println("S3/R2 credentials not fully set, skipping S3 initialization. Thumbnail uploads will fail if attempted.")
		return nil
	}

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion("auto"),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
	)
	if err != nil {
		return err
	}

	S3Client = s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	PresignClient = s3.NewPresignClient(S3Client)

	// Ensure bucket exists (best effort for local emulators)
	_, err = S3Client.CreateBucket(context.TODO(), &s3.CreateBucketInput{
		Bucket: aws.String(BucketName),
	})
	if err != nil {
		log.Printf("S3 CreateBucket note (can be ignored if bucket already exists): %v", err)
	}

	// Apply CORS rules so the frontend can directly fetch presigned URLs
	_, err = S3Client.PutBucketCors(context.TODO(), &s3.PutBucketCorsInput{
		Bucket: aws.String(BucketName),
		CORSConfiguration: &types.CORSConfiguration{
			CORSRules: []types.CORSRule{
				{
					AllowedHeaders: []string{"*"},
					AllowedMethods: []string{"GET", "PUT", "HEAD"},
					AllowedOrigins: []string{"*"}, // Restrict this in production!
					MaxAgeSeconds:  aws.Int32(3600),
				},
			},
		},
	})
	if err != nil {
		log.Printf("S3 PutBucketCors note: %v", err)
	}

	log.Println("S3 Client initialized for bucket:", BucketName)
	return nil
}

func UploadThumbnail(ctx context.Context, key string, data []byte) error {
	if S3Client == nil {
		return fmt.Errorf("S3 client not initialized")
	}

	_, err := S3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(BucketName),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String("application/octet-stream"),
	})
	return err
}

func GeneratePresignedURL(ctx context.Context, key string) (string, error) {
	if PresignClient == nil {
		return "", fmt.Errorf("S3 presign client not initialized")
	}

	req, err := PresignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(BucketName),
		Key:    aws.String(key),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = 1 * time.Hour
	})
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

func DeleteThumbnail(ctx context.Context, key string) error {
	if S3Client == nil {
		return fmt.Errorf("S3 client not initialized")
	}

	_, err := S3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(BucketName),
		Key:    aws.String(key),
	})
	return err
}
