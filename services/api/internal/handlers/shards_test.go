package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"aether-server/internal/db"
	"aether-server/internal/models"
	"github.com/gofiber/fiber/v2"
)

func TestAllocateShards(t *testing.T) {
	setupTestDB(t)

	app := fiber.New()
	app.Post("/shards/allocate", AllocateShards)

	// Create test user
	user := models.User{
		Username:    "bob",
		AuthHash:    []byte("Placeholder"),
		AuthVersion: 1,
	}
	if err := db.DB.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Create JWT token for authorization
	tokenResp, err := issueToken(user)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	// Create test volume
	volume := models.Volume{
		ID:     "vol123",
		UserID: user.ID,
		Name:   "default",
	}
	db.DB.Create(&volume)

	// Create test file
	file := models.File{
		UserID:   user.ID,
		VolumeID: volume.ID,
		Name:     "test.txt",
		Size:     100,
	}
	db.DB.Create(&file)

	// Create test file version
	version := models.FileVersion{
		FileID:  file.ID,
		Version: 1,
		Size:    100,
	}
	db.DB.Create(&version)

	// 1. Allocate shards with no storage providers linked (Should return 400 Bad Request)
	allocReq := AllocateShardRequest{
		FileVersionID: version.ID,
		ChunkIndex:    0,
		ChunkSize:     100,
	}
	allocBody, _ := json.Marshal(allocReq)

	req := httptest.NewRequest("POST", "/shards/allocate", bytes.NewReader(allocBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tokenResp.Token)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("AllocateShards request failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 when no providers are linked, got %d", resp.StatusCode)
	}

	// 2. Link a provider and allocate shards (Should succeed with 14 allocations)
	provider := models.UserProvider{
		UserID:   user.ID,
		Provider: "GoogleDrive",
		Config:   "{}",
	}
	db.DB.Create(&provider)

	req = httptest.NewRequest("POST", "/shards/allocate", bytes.NewReader(allocBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tokenResp.Token)
	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("AllocateShards request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200 after provider linked, got %d", resp.StatusCode)
	}

	var allocResp struct {
		Allocation ChunkAllocationResponse `json:"allocation"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&allocResp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if allocResp.Allocation.DataShards != 10 {
		t.Errorf("Expected 10 data shards, got %d", allocResp.Allocation.DataShards)
	}
	if allocResp.Allocation.ParityShards != 4 {
		t.Errorf("Expected 4 parity shards, got %d", allocResp.Allocation.ParityShards)
	}
	if len(allocResp.Allocation.Allocations) != 14 {
		t.Errorf("Expected 14 shard allocations, got %d", len(allocResp.Allocation.Allocations))
	}

	// Check if chunk and shards are stored in DB
	var dbChunk models.Chunk
	if err := db.DB.Where("file_version_id = ? AND chunk_index = ?", version.ID, 0).First(&dbChunk).Error; err != nil {
		t.Fatalf("Chunk not found in DB: %v", err)
	}

	var dbShards []models.Shard
	db.DB.Where("chunk_id = ?", dbChunk.ID).Find(&dbShards)
	if len(dbShards) != 14 {
		t.Errorf("Expected 14 shards in DB, got %d", len(dbShards))
	}
}
