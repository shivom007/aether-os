package handlers

import (
	"encoding/json"
	"fmt"
	"strings"

	"aether-server/internal/crypto"
	"aether-server/internal/db"
	"aether-server/internal/models"
	"aether-server/internal/providers"
)

// ResolveProvider returns the appropriate StorageProvider and its configuration
func ResolveProvider(providerName string) (providers.StorageProvider, map[string]string, error) {
	if strings.HasPrefix(providerName, "UserProvider_") {
		idStr := strings.TrimPrefix(providerName, "UserProvider_")
		var up models.UserProvider
		if err := db.DB.First(&up, idStr).Error; err != nil {
			return nil, nil, fmt.Errorf("user provider not found: %v", err)
		}
		
		var cfg map[string]string
		decrypted, err := crypto.DecryptProviderConfig(up.Config)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to decrypt provider config: %v", err)
		}
		if err := json.Unmarshal([]byte(decrypted), &cfg); err != nil {
			return nil, nil, err
		}

		switch up.Provider {
		case "AWS_S3":
			return providers.NewS3Provider(), cfg, nil
		case "GoogleDrive":
			return providers.NewGoogleDriveProvider(), cfg, nil
		case "Dropbox":
			return providers.NewDropboxProvider(), cfg, nil
		default:
			return nil, nil, fmt.Errorf("unknown user provider type: %s", up.Provider)
		}
	}

	p, exists := providers.Registry[providerName]
	if !exists {
		return nil, nil, fmt.Errorf("provider not found: %s", providerName)
	}
	return p, nil, nil
}
