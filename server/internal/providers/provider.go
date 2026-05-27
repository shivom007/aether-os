package providers

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// StorageProvider defines the interface for interacting with Cloud Providers.
type StorageProvider interface {
	UploadShard(shardID string, data io.Reader, config map[string]string) (string, error)
	DownloadShard(providerFileID string, config map[string]string) (io.ReadCloser, error)
	DeleteShard(providerFileID string, config map[string]string) error
}

// MockProvider simulates a cloud provider by writing to the local disk.
// This allows the MVP pipeline to be tested without requiring OAuth tokens.
type MockProvider struct {
	Name    string
	BaseDir string
}

func NewMockProvider(name string) *MockProvider {
	dir := filepath.Join(".", "storage", name)
	os.MkdirAll(dir, os.ModePerm)
	return &MockProvider{
		Name:    name,
		BaseDir: dir,
	}
}

func (m *MockProvider) UploadShard(shardID string, data io.Reader, config map[string]string) (string, error) {
	providerFileID := fmt.Sprintf("%s_%s.shard", m.Name, shardID)
	filePath := filepath.Join(m.BaseDir, providerFileID)

	file, err := os.Create(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	if _, err := io.Copy(file, data); err != nil {
		return "", err
	}

	return providerFileID, nil
}

func (m *MockProvider) DownloadShard(providerFileID string, config map[string]string) (io.ReadCloser, error) {
	filePath := filepath.Join(m.BaseDir, providerFileID)
	return os.Open(filePath)
}

func (m *MockProvider) DeleteShard(providerFileID string, config map[string]string) error {
	filePath := filepath.Join(m.BaseDir, providerFileID)
	return os.Remove(filePath)
}

// Global registry of providers
var Registry = map[string]StorageProvider{
	"GoogleDrive": NewMockProvider("googledrive"),
	"Dropbox":     NewMockProvider("dropbox"),
	"AWS_S3":      NewMockProvider("aws_s3"),
}
