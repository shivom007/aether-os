package handlers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"aether-server/internal/crypto"
	"aether-server/internal/db"
	"aether-server/internal/models"
)

type AWSCredentialsRequest struct {
	AccessKey    string `json:"accessKey"`
	SecretKey    string `json:"secretKey"`
	Region       string `json:"region"`
	Bucket       string `json:"bucket"`
	EndpointURL  string `json:"endpointUrl"`
	ProviderType string `json:"providerType"`
}

func getAPIBaseURL() string {
	url := os.Getenv("API_BASE_URL")
	if url == "" {
		return "http://localhost:8080/api/v1"
	}
	return url
}

// getPublicAPIBaseURL returns the publicly accessible backend URL.
// This MUST be used for OAuth callbacks — internal Railway URLs are unreachable by Google/Dropbox.
func getPublicAPIBaseURL() string {
	url := os.Getenv("PUBLIC_API_BASE_URL")
	if url != "" {
		return url
	}
	// Fall back to API_BASE_URL if PUBLIC_API_BASE_URL is not explicitly set
	return getAPIBaseURL()
}

func getFrontendURL() string {
	url := os.Getenv("FRONTEND_URL")
	if url == "" {
		return "http://localhost:3000"
	}
	return url
}

func getGoogleOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		Endpoint:     google.Endpoint,
		RedirectURL:  getPublicAPIBaseURL() + "/providers/google/callback",
		Scopes:       []string{"https://www.googleapis.com/auth/drive.file"},
	}
}

func getDropboxOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     os.Getenv("DROPBOX_CLIENT_ID"),
		ClientSecret: os.Getenv("DROPBOX_CLIENT_SECRET"),
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://www.dropbox.com/oauth2/authorize",
			TokenURL: "https://api.dropboxapi.com/oauth2/token",
		},
		RedirectURL: getPublicAPIBaseURL() + "/providers/dropbox/callback",
	}
}

// ListProviders returns the linked providers for the current user.
func ListProviders(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var userProviders []models.UserProvider
	db.DB.Where("user_id = ?", userID).Find(&userProviders)

	// Return sanitized list with config details
	type ProviderResponse struct {
		ID           uint   `json:"id"`
		Provider     string `json:"provider"`
		ProviderType string `json:"providerType"`
		EndpointURL  string `json:"endpointUrl"`
		Bucket       string `json:"bucket"`
		Region       string `json:"region"`
	}
	res := []ProviderResponse{}
	for _, p := range userProviders {
		var cfg map[string]string
		decrypted, err := crypto.DecryptProviderConfig(p.Config)
		if err != nil {
			fmt.Println("Error decrypting provider config:", err)
			continue
		}
		json.Unmarshal([]byte(decrypted), &cfg)

		pType := cfg["providerType"]
		if pType == "" {
			pType = p.Provider
		}

		res = append(res, ProviderResponse{
			ID:           p.ID,
			Provider:     p.Provider,
			ProviderType: pType,
			EndpointURL:  cfg["endpointUrl"],
			Bucket:       cfg["bucket"],
			Region:       cfg["region"],
		})
	}

	return c.JSON(res)
}

// LinkAWS accepts IAM credentials for AWS S3
func LinkAWS(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req AWSCredentialsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	cfgMap := map[string]string{
		"accessKey":    req.AccessKey,
		"secretKey":    req.SecretKey,
		"region":       req.Region,
		"bucket":       req.Bucket,
		"endpointUrl":  req.EndpointURL,
		"providerType": req.ProviderType,
	}
	cfgBytes, _ := json.Marshal(cfgMap)
	encryptedCfg, err := crypto.EncryptProviderConfig(string(cfgBytes))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Encryption failed"})
	}

	provider := models.UserProvider{
		UserID:   userID,
		Provider: "AWS_S3",
		Config:   encryptedCfg,
	}
	db.DB.Create(&provider)

	return c.Status(201).JSON(fiber.Map{"message": "AWS S3 linked successfully", "id": provider.ID})
}

// UnlinkProvider removes a linked provider
func UnlinkProvider(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	providerID := c.Params("id")
	if err := db.DB.Where("id = ? AND user_id = ?", providerID, userID).Delete(&models.UserProvider{}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to unlink provider"})
	}

	return c.JSON(fiber.Map{"message": "Provider unlinked"})
}

// OAuth Handlers

type OAuthState struct {
	SessionID string `json:"sessionId"`
	ReturnTo  string `json:"returnTo"`
}

func encodeState(sessionID, returnTo string) string {
	state := OAuthState{SessionID: sessionID, ReturnTo: returnTo}
	b, _ := json.Marshal(state)
	return base64.URLEncoding.EncodeToString(b)
}

func decodeState(encoded string) (OAuthState, error) {
	var state OAuthState
	b, err := base64.URLEncoding.DecodeString(encoded)
	if err != nil {
		return state, err
	}
	err = json.Unmarshal(b, &state)
	return state, err
}

func CreateOAuthSession(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Provider string `json:"provider"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Generate 16-byte secure random ID (32 hex characters) to fit in varchar(36)
	b := make([]byte, 16)
	rand.Read(b)
	sessionID := hex.EncodeToString(b)

	session := models.OAuthSession{
		ID:       sessionID,
		UserID:   userID,
		Provider: req.Provider,
	}

	if err := db.DB.Create(&session).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create OAuth session"})
	}

	return c.JSON(fiber.Map{"sessionId": sessionID})
}

// In a real app, the token would be stored securely or passed via secure cookie.
// We now use an ephemeral database session instead of passing the JWT!
func GoogleAuth(c *fiber.Ctx) error {
	sessionID := c.Query("session_id")
	returnTo := c.Query("returnTo")
	if sessionID == "" {
		return c.Status(400).SendString("Missing session_id")
	}
	
	// Verify session exists
	var session models.OAuthSession
	if err := db.DB.Where("id = ?", sessionID).First(&session).Error; err != nil {
		return c.Status(400).SendString("Invalid or expired session")
	}

	stateParam := encodeState(sessionID, returnTo)
	url := getGoogleOAuthConfig().AuthCodeURL(stateParam, oauth2.AccessTypeOffline, oauth2.ApprovalForce)
	return c.Redirect(url)
}

func GoogleCallback(c *fiber.Ctx) error {
	stateParam := c.Query("state")
	code := c.Query("code")

	state, err := decodeState(stateParam)
	if err != nil {
		return c.Status(400).SendString("Invalid state parameter")
	}
	stateSessionID := state.SessionID
	returnTo := state.ReturnTo
	if returnTo == "" {
		returnTo = getFrontendURL()
	}

	fmt.Println("GoogleCallback received stateSessionID length:", len(stateSessionID), "code length:", len(code))

	// Verify session to get User ID
	var session models.OAuthSession
	if err := db.DB.Where("id = ?", stateSessionID).First(&session).Error; err != nil {
		return c.Status(401).SendString("Unauthorized callback: invalid state")
	}

	userID := session.UserID
	fmt.Println("GoogleCallback resolved userID:", userID)

	// Delete the session so it can't be reused
	db.DB.Delete(&session)

	token, err := getGoogleOAuthConfig().Exchange(context.Background(), code)
	if err != nil {
		return c.Status(500).SendString("Failed to exchange token")
	}

	cfgMap := map[string]string{
		"access_token":  token.AccessToken,
		"refresh_token": token.RefreshToken,
		"expiry":        token.Expiry.Format(time.RFC3339),
		"client_id":     os.Getenv("GOOGLE_CLIENT_ID"),
		"client_secret": os.Getenv("GOOGLE_CLIENT_SECRET"),
	}
	cfgBytes, _ := json.Marshal(cfgMap)
	encryptedCfg, err := crypto.EncryptProviderConfig(string(cfgBytes))
	if err != nil {
		return c.Status(500).SendString("Failed to encrypt config")
	}

	provider := models.UserProvider{
		UserID:   userID,
		Provider: "GoogleDrive",
		Config:   encryptedCfg,
	}

	db.DB.Create(&provider)

	// Redirect back to dashboard
	return c.Redirect(returnTo + "/dashboard/providers")
}

func DropboxAuth(c *fiber.Ctx) error {
	sessionID := c.Query("session_id")
	returnTo := c.Query("returnTo")
	if sessionID == "" {
		return c.Status(400).SendString("Missing session_id")
	}
	
	// Verify session exists
	var session models.OAuthSession
	if err := db.DB.Where("id = ?", sessionID).First(&session).Error; err != nil {
		return c.Status(400).SendString("Invalid or expired session")
	}

	stateParam := encodeState(sessionID, returnTo)
	url := getDropboxOAuthConfig().AuthCodeURL(
		stateParam, 
		oauth2.SetAuthURLParam("token_access_type", "offline"),
		oauth2.SetAuthURLParam("force_reapprove", "true"),
	)
	return c.Redirect(url)
}

func DropboxCallback(c *fiber.Ctx) error {
	stateParam := c.Query("state")
	code := c.Query("code")

	state, err := decodeState(stateParam)
	if err != nil {
		return c.Status(400).SendString("Invalid state parameter")
	}
	stateSessionID := state.SessionID
	returnTo := state.ReturnTo
	if returnTo == "" {
		returnTo = getFrontendURL()
	}

	// Verify session to get User ID
	var session models.OAuthSession
	if err := db.DB.Where("id = ?", stateSessionID).First(&session).Error; err != nil {
		return c.Status(401).SendString("Unauthorized callback: invalid state")
	}

	userID := session.UserID
	db.DB.Delete(&session)

	token, err := getDropboxOAuthConfig().Exchange(context.Background(), code)
	if err != nil {
		return c.Status(500).SendString("Failed to exchange token")
	}

	cfgMap := map[string]string{
		"access_token":  token.AccessToken,
		"refresh_token": token.RefreshToken,
		"expiry":        token.Expiry.Format(time.RFC3339),
		"client_id":     os.Getenv("DROPBOX_CLIENT_ID"),
		"client_secret": os.Getenv("DROPBOX_CLIENT_SECRET"),
	}
	cfgBytes, _ := json.Marshal(cfgMap)
	encryptedCfg, err := crypto.EncryptProviderConfig(string(cfgBytes))
	if err != nil {
		return c.Status(500).SendString("Failed to encrypt config")
	}

	provider := models.UserProvider{
		UserID:   userID,
		Provider: "Dropbox",
		Config:   encryptedCfg,
	}

	db.DB.Create(&provider)

	return c.Redirect(returnTo + "/dashboard/providers")
}

// ProviderLatency returns the measured network latency from the Go backend to each linked provider.
func ProviderLatency(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var userProviders []models.UserProvider
	db.DB.Where("user_id = ?", userID).Find(&userProviders)

	if len(userProviders) == 0 {
		return c.JSON(fiber.Map{})
	}

	latencies := make(map[uint]int64)

	for _, p := range userProviders {
		var url string
		var method string = "GET"

		if p.Provider == "GoogleDrive" {
			url = "https://www.googleapis.com/drive/v3/about"
		} else if p.Provider == "Dropbox" {
			url = "https://api.dropboxapi.com/2/users/get_current_account"
			method = "POST"
		} else {
			// Skip unsupported or fast providers like local/AWS if we don't have a direct ping
			continue
		}

		// Perform a lightweight request (even if unauthorized, it measures TTFB)
		req, err := http.NewRequest(method, url, nil)
		if err != nil {
			continue
		}
		
		// Set a dummy authorization so the API gateway parses it rather than immediate edge block
		req.Header.Set("Authorization", "Bearer invalid_token")

		start := time.Now()
		resp, err := http.DefaultClient.Do(req)
		elapsed := time.Since(start).Milliseconds()

		if resp != nil && resp.Body != nil {
			resp.Body.Close()
		}

		latencies[p.ID] = elapsed
	}

	return c.JSON(latencies)
}
