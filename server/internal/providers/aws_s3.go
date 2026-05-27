package providers

import (
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Provider struct{}

func NewS3Provider() *S3Provider {
	return &S3Provider{}
}

func (p *S3Provider) getClient(cfg map[string]string) (*s3.Client, string, error) {
	accessKey := cfg["accessKey"]
	secretKey := cfg["secretKey"]
	region := cfg["region"]
	bucket := cfg["bucket"]
	endpointUrl := cfg["endpointUrl"]

	if accessKey == "" || secretKey == "" || region == "" || bucket == "" {
		return nil, "", fmt.Errorf("missing AWS credentials or config")
	}

	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		if endpointUrl != "" {
			return aws.Endpoint{
				URL:           endpointUrl,
				SigningRegion: region,
			}, nil
		}
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	awsCfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
		config.WithEndpointResolverWithOptions(customResolver),
	)
	if err != nil {
		return nil, "", err
	}

	return s3.NewFromConfig(awsCfg), bucket, nil
}

func (p *S3Provider) UploadShard(shardID string, data io.Reader, cfg map[string]string) (string, error) {
	client, bucket, err := p.getClient(cfg)
	if err != nil {
		return "", err
	}

	key := fmt.Sprintf("aether_%s.shard", shardID)
	_, err = client.PutObject(context.TODO(), &s3.PutObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
		Body:   data,
	})

	if err != nil {
		return "", err
	}

	return key, nil
}

func (p *S3Provider) DownloadShard(providerFileID string, cfg map[string]string) (io.ReadCloser, error) {
	client, bucket, err := p.getClient(cfg)
	if err != nil {
		return nil, err
	}

	res, err := client.GetObject(context.TODO(), &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(providerFileID),
	})
	if err != nil {
		return nil, err
	}

	return res.Body, nil
}

func (p *S3Provider) DeleteShard(providerFileID string, cfg map[string]string) error {
	client, bucket, err := p.getClient(cfg)
	if err != nil {
		return err
	}

	_, err = client.DeleteObject(context.TODO(), &s3.DeleteObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(providerFileID),
	})
	return err
}
