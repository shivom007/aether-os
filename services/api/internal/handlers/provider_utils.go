package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"aether-server/internal/crypto"
	"aether-server/internal/db"
	"aether-server/internal/models"
	"aether-server/internal/providers"
	"golang.org/x/oauth2"
)

type ResolvedProvider struct {
	Provider providers.StorageProvider
	Config   map[string]string
}

// ResolveProvider returns the appropriate StorageProvider and its configuration
func ResolveProvider(providerName string) (providers.StorageProvider, map[string]string, error) {
	resolved, err := ResolveProviders([]string{providerName})
	if err != nil {
		return nil, nil, err
	}

	provider, exists := resolved[providerName]
	if !exists {
		return nil, nil, fmt.Errorf("provider not found: %s", providerName)
	}
	return provider.Provider, provider.Config, nil
}

// ResolveProviders resolves unique provider names in batches so shard loops do not
// repeatedly query and decrypt the same UserProvider rows.
func ResolveProviders(providerNames []string) (map[string]ResolvedProvider, error) {
	resolved := make(map[string]ResolvedProvider)
	userProviderIDs := make([]uint, 0)
	userProviderNames := make(map[uint][]string)

	for _, providerName := range providerNames {
		if providerName == "" {
			continue
		}
		if _, exists := resolved[providerName]; exists {
			continue
		}

		if strings.HasPrefix(providerName, "UserProvider_") {
			idStr := strings.TrimPrefix(providerName, "UserProvider_")
			id, err := strconv.ParseUint(idStr, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid user provider id %q: %v", idStr, err)
			}

			userProviderID := uint(id)
			if _, exists := userProviderNames[userProviderID]; !exists {
				userProviderIDs = append(userProviderIDs, userProviderID)
			}
			userProviderNames[userProviderID] = append(userProviderNames[userProviderID], providerName)
			continue
		}

		p, exists := providers.Registry[providerName]
		if !exists {
			return nil, fmt.Errorf("provider not found: %s", providerName)
		}
		resolved[providerName] = ResolvedProvider{Provider: p}
	}

	if len(userProviderIDs) == 0 {
		return resolved, nil
	}

	var userProviders []models.UserProvider
	if err := db.DB.Where("id IN ?", userProviderIDs).Find(&userProviders).Error; err != nil {
		return nil, fmt.Errorf("failed to load user providers: %v", err)
	}

	loadedProviders := make(map[uint]models.UserProvider, len(userProviders))
	for _, up := range userProviders {
		loadedProviders[up.ID] = up
	}

	for _, id := range userProviderIDs {
		up, exists := loadedProviders[id]
		if !exists {
			return nil, fmt.Errorf("user provider %d not found", id)
		}

		provider, cfg, err := resolveUserProvider(up)
		if err != nil {
			return nil, err
		}

		for _, providerName := range userProviderNames[id] {
			resolved[providerName] = ResolvedProvider{
				Provider: provider,
				Config:   cfg,
			}
		}
	}

	return resolved, nil
}

func resolveUserProvider(up models.UserProvider) (providers.StorageProvider, map[string]string, error) {
	var cfg map[string]string
	decrypted, err := crypto.DecryptProviderConfig(up.Config)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to decrypt provider config: %v", err)
	}
	if err := json.Unmarshal([]byte(decrypted), &cfg); err != nil {
		return nil, nil, err
	}

	var provider providers.StorageProvider
	var oauthConf *oauth2.Config

	switch up.Provider {
	case "AWS_S3":
		return providers.NewS3Provider(), cfg, nil
	case "GoogleDrive":
		provider = providers.NewGoogleDriveProvider()
		oauthConf = getGoogleOAuthConfig()
	case "Dropbox":
		provider = providers.NewDropboxProvider()
		oauthConf = getDropboxOAuthConfig()
	default:
		return nil, nil, fmt.Errorf("unknown user provider type: %s", up.Provider)
	}

	if oauthConf != nil {
		accessToken := cfg["access_token"]
		refreshToken := cfg["refresh_token"]
		expiryStr := cfg["expiry"]

		var expiry time.Time
		if expiryStr != "" {
			expiry, _ = time.Parse(time.RFC3339, expiryStr)
		}

		if refreshToken != "" && (expiry.IsZero() || time.Until(expiry) < 5*time.Minute) {
			tok := &oauth2.Token{
				AccessToken:  accessToken,
				RefreshToken: refreshToken,
				Expiry:       expiry,
			}

			ts := oauthConf.TokenSource(context.Background(), tok)
			freshTok, err := ts.Token()
			if err == nil && freshTok.AccessToken != accessToken {
				cfg["access_token"] = freshTok.AccessToken
				cfg["expiry"] = freshTok.Expiry.Format(time.RFC3339)
				if freshTok.RefreshToken != "" {
					cfg["refresh_token"] = freshTok.RefreshToken
				}

				cfgBytes, _ := json.Marshal(cfg)
				encryptedCfg, err := crypto.EncryptProviderConfig(string(cfgBytes))
				if err == nil {
					db.DB.Model(&models.UserProvider{}).Where("id = ?", up.ID).Update("config", encryptedCfg)
				}
			}
		}
	}

	return provider, cfg, nil
}
