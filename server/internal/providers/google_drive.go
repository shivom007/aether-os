package providers

import (
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

type GoogleDriveProvider struct{}

func NewGoogleDriveProvider() *GoogleDriveProvider {
	return &GoogleDriveProvider{}
}

func (p *GoogleDriveProvider) getService(cfg map[string]string) (*drive.Service, error) {
	accessToken := cfg["access_token"]
	refreshToken := cfg["refresh_token"]
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("missing Google OAuth credentials in env")
	}

	conf := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Endpoint:     google.Endpoint,
		Scopes:       []string{drive.DriveFileScope},
	}

	var expiry time.Time
	if expiryStr, ok := cfg["expiry"]; ok && expiryStr != "" {
		expiry, _ = time.Parse(time.RFC3339, expiryStr)
	}

	token := &oauth2.Token{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		Expiry:       expiry,
	}

	client := conf.Client(context.Background(), token)
	return drive.NewService(context.Background(), option.WithHTTPClient(client))
}

func (p *GoogleDriveProvider) UploadShard(shardID string, data io.Reader, cfg map[string]string) (string, error) {
	srv, err := p.getService(cfg)
	if err != nil {
		return "", err
	}

	fileName := fmt.Sprintf("aether_%s.shard", shardID)
	f := &drive.File{Name: fileName}

	res, err := srv.Files.Create(f).Media(data).Do()
	if err != nil {
		return "", err
	}

	return res.Id, nil
}

func (p *GoogleDriveProvider) DownloadShard(providerFileID string, cfg map[string]string) (io.ReadCloser, error) {
	srv, err := p.getService(cfg)
	if err != nil {
		return nil, err
	}

	res, err := srv.Files.Get(providerFileID).Download()
	if err != nil {
		return nil, err
	}

	return res.Body, nil
}

func (p *GoogleDriveProvider) DeleteShard(providerFileID string, cfg map[string]string) error {
	srv, err := p.getService(cfg)
	if err != nil {
		return err
	}

	return srv.Files.Delete(providerFileID).Do()
}
