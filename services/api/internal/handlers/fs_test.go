package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"aether-server/internal/db"
	"aether-server/internal/models"
	"github.com/gofiber/fiber/v2"
)

func TestUpdateFileMediaMetadata(t *testing.T) {
	setupTestDB(t)

	user := models.User{
		Username:    "media-owner",
		AuthHash:    []byte("placeholder"),
		AuthVersion: 1,
	}
	if err := db.DB.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	token, err := issueToken(user)
	if err != nil {
		t.Fatalf("failed to issue token: %v", err)
	}

	volume := models.Volume{ID: "media-volume", UserID: user.ID, Name: "Media"}
	if err := db.DB.Create(&volume).Error; err != nil {
		t.Fatalf("failed to create volume: %v", err)
	}
	file := models.File{
		UserID:   user.ID,
		VolumeID: volume.ID,
		Name:     "movie.mkv",
		Size:     100,
		MimeType: "video/matroska",
	}
	if err := db.DB.Create(&file).Error; err != nil {
		t.Fatalf("failed to create file: %v", err)
	}

	app := fiber.New()
	app.Patch("/files/:id/media-metadata", UpdateFileMediaMetadata)

	metadata := `{"schema_version":1,"container":"Matroska","tracks":[{"kind":"video","codec":"AVC"},{"kind":"audio","codec":"E-AC-3"}]}`
	body, _ := json.Marshal(UpdateFileMediaMetadataRequest{MediaMetadata: metadata})
	req := httptest.NewRequest(
		http.MethodPatch,
		"/files/"+strconv.FormatUint(uint64(file.ID), 10)+"/media-metadata",
		bytes.NewReader(body),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token.Token)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("metadata update request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	var updated models.File
	if err := db.DB.First(&updated, file.ID).Error; err != nil {
		t.Fatalf("failed to reload file: %v", err)
	}
	if updated.MediaMetadata != metadata {
		t.Fatalf("unexpected stored metadata: %s", updated.MediaMetadata)
	}

	invalidBody, _ := json.Marshal(UpdateFileMediaMetadataRequest{MediaMetadata: "{invalid"})
	req = httptest.NewRequest(
		http.MethodPatch,
		"/files/"+strconv.FormatUint(uint64(file.ID), 10)+"/media-metadata",
		bytes.NewReader(invalidBody),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token.Token)

	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("invalid metadata request failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected status 400 for invalid metadata, got %d", resp.StatusCode)
	}
}
