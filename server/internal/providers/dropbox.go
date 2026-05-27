package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/oauth2"
)

type DropboxProvider struct{}

func NewDropboxProvider() *DropboxProvider {
	return &DropboxProvider{}
}

func getDropboxClient(cfg map[string]string) *http.Client {
	var expiry time.Time
	if expiryStr, ok := cfg["expiry"]; ok && expiryStr != "" {
		expiry, _ = time.Parse(time.RFC3339, expiryStr)
	}

	token := &oauth2.Token{
		AccessToken:  cfg["access_token"],
		RefreshToken: cfg["refresh_token"],
		TokenType:    "Bearer",
		Expiry:       expiry,
	}

	conf := &oauth2.Config{
		ClientID:     cfg["client_id"],
		ClientSecret: cfg["client_secret"],
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://www.dropbox.com/oauth2/authorize",
			TokenURL: "https://api.dropboxapi.com/oauth2/token",
		},
	}

	return conf.Client(context.Background(), token)
}

func (p *DropboxProvider) UploadShard(shardID string, data io.Reader, cfg map[string]string) (string, error) {
	if cfg["access_token"] == "" {
		return "", fmt.Errorf("missing Dropbox access token")
	}

	fileName := fmt.Sprintf("/aether_%s.shard", shardID)

	apiArgs := map[string]interface{}{
		"path":       fileName,
		"mode":       "add",
		"autorename": true,
		"mute":       true,
		"strict_conflict": false,
	}
	apiArgsBytes, _ := json.Marshal(apiArgs)

	req, err := http.NewRequest("POST", "https://content.dropboxapi.com/2/files/upload", data)
	if err != nil {
		return "", err
	}

	// Dropbox requires Authorization header, but the oauth2 client adds it automatically!
	req.Header.Set("Dropbox-API-Arg", string(apiArgsBytes))
	req.Header.Set("Content-Type", "application/octet-stream")

	client := getDropboxClient(cfg)
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("dropbox upload failed: %s", string(respBody))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result["id"].(string), nil
}

func (p *DropboxProvider) DownloadShard(providerFileID string, cfg map[string]string) (io.ReadCloser, error) {
	if cfg["access_token"] == "" {
		return nil, fmt.Errorf("missing Dropbox access token")
	}

	apiArgs := map[string]interface{}{
		"path": providerFileID, // It returns 'id:xxxx'
	}
	apiArgsBytes, _ := json.Marshal(apiArgs)

	req, err := http.NewRequest("POST", "https://content.dropboxapi.com/2/files/download", nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Dropbox-API-Arg", string(apiArgsBytes))

	client := getDropboxClient(cfg)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("dropbox download failed: %s", string(respBody))
	}

	return resp.Body, nil
}

func (p *DropboxProvider) DeleteShard(providerFileID string, cfg map[string]string) error {
	if cfg["access_token"] == "" {
		return fmt.Errorf("missing Dropbox access token")
	}

	reqBody, _ := json.Marshal(map[string]interface{}{
		"path": providerFileID,
	})

	req, err := http.NewRequest("POST", "https://api.dropboxapi.com/2/files/delete_v2", bytes.NewBuffer(reqBody))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")

	client := getDropboxClient(cfg)
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("dropbox delete failed: %s", string(respBody))
	}

	return nil
}
