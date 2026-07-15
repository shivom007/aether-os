package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
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
		"path":            fileName,
		"mode":            "add",
		"autorename":      true,
		"mute":            true,
		"strict_conflict": false,
	}
	apiArgsBytes, _ := json.Marshal(apiArgs)

	// Since we might need to retry, and data (io.Reader) can only be read once,
	// we must read data into a buffer first if we want to retry!
	var bodyBytes []byte
	var err error
	if data != nil {
		bodyBytes, err = io.ReadAll(data)
		if err != nil {
			return "", fmt.Errorf("failed to read upload data: %v", err)
		}
	}

	maxRetries := 3
	backoff := 1500 * time.Millisecond

	for attempt := 0; attempt <= maxRetries; attempt++ {
		req, err := http.NewRequest("POST", "https://content.dropboxapi.com/2/files/upload", bytes.NewReader(bodyBytes))
		if err != nil {
			return "", err
		}

		req.Header.Set("Dropbox-API-Arg", string(apiArgsBytes))
		req.Header.Set("Content-Type", "application/octet-stream")

		client := getDropboxClient(cfg)
		resp, err := client.Do(req)
		if err != nil {
			if attempt < maxRetries {
				time.Sleep(backoff)
				backoff *= 2
				continue
			}
			return "", err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			respBody, _ := io.ReadAll(resp.Body)
			bodyStr := string(respBody)

			isRateLimit := resp.StatusCode == http.StatusTooManyRequests ||
				strings.Contains(bodyStr, "too_many_write_operations") ||
				strings.Contains(bodyStr, "rate_limiting")

			if isRateLimit && attempt < maxRetries {
				time.Sleep(backoff)
				backoff *= 2
				continue
			}
			return "", fmt.Errorf("dropbox upload failed: %s", bodyStr)
		}

		var result map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return "", err
		}

		return result["id"].(string), nil
	}

	return "", fmt.Errorf("dropbox upload failed after retries")
}

func (p *DropboxProvider) DownloadShard(providerFileID string, cfg map[string]string) (io.ReadCloser, error) {
	if cfg["access_token"] == "" {
		return nil, fmt.Errorf("missing Dropbox access token")
	}

	apiArgs := map[string]interface{}{
		"path": providerFileID,
	}
	apiArgsBytes, _ := json.Marshal(apiArgs)

	maxRetries := 3
	backoff := 1500 * time.Millisecond

	for attempt := 0; attempt <= maxRetries; attempt++ {
		req, err := http.NewRequest("POST", "https://content.dropboxapi.com/2/files/download", nil)
		if err != nil {
			return nil, err
		}

		req.Header.Set("Dropbox-API-Arg", string(apiArgsBytes))

		client := getDropboxClient(cfg)
		resp, err := client.Do(req)
		if err != nil {
			if attempt < maxRetries {
				time.Sleep(backoff)
				backoff *= 2
				continue
			}
			return nil, err
		}

		if resp.StatusCode != http.StatusOK {
			respBody, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			bodyStr := string(respBody)

			isRateLimit := resp.StatusCode == http.StatusTooManyRequests ||
				strings.Contains(bodyStr, "rate_limiting") ||
				strings.Contains(bodyStr, "too_many_write_operations")

			if isRateLimit && attempt < maxRetries {
				time.Sleep(backoff)
				backoff *= 2
				continue
			}
			return nil, fmt.Errorf("dropbox download failed: %s", bodyStr)
		}

		return resp.Body, nil
	}

	return nil, fmt.Errorf("dropbox download failed after retries")
}

func (p *DropboxProvider) DeleteShard(providerFileID string, cfg map[string]string) error {
	if cfg["access_token"] == "" {
		return fmt.Errorf("missing Dropbox access token")
	}

	reqBody, _ := json.Marshal(map[string]interface{}{
		"path": providerFileID,
	})

	maxRetries := 3
	backoff := 1500 * time.Millisecond

	for attempt := 0; attempt <= maxRetries; attempt++ {
		req, err := http.NewRequest("POST", "https://api.dropboxapi.com/2/files/delete_v2", bytes.NewReader(reqBody))
		if err != nil {
			return err
		}

		req.Header.Set("Content-Type", "application/json")

		client := getDropboxClient(cfg)
		resp, err := client.Do(req)
		if err != nil {
			if attempt < maxRetries {
				time.Sleep(backoff)
				backoff *= 2
				continue
			}
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			respBody, _ := io.ReadAll(resp.Body)
			bodyStr := string(respBody)

			isRateLimit := resp.StatusCode == http.StatusTooManyRequests ||
				strings.Contains(bodyStr, "rate_limiting") ||
				strings.Contains(bodyStr, "too_many_write_operations")

			if isRateLimit && attempt < maxRetries {
				time.Sleep(backoff)
				backoff *= 2
				continue
			}
			return fmt.Errorf("dropbox delete failed: %s", bodyStr)
		}

		return nil
	}

	return fmt.Errorf("dropbox delete failed after retries")
}
