package handlers

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"aether-server/internal/db"
	"aether-server/internal/models"
	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) {
	os.Setenv("GO_JWT_SECRET", "test-secret-at-least-32-characters-long")
	os.Setenv("AETHER_BFF_JWT_SECRET", "test-bff-secret-at-least-32-chars")
	var err error
	db.DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

	err = db.DB.AutoMigrate(
		&models.User{},
		&models.Volume{},
		&models.Folder{},
		&models.File{},
		&models.FileVersion{},
		&models.Chunk{},
		&models.Shard{},
		&models.UserProvider{},
		&models.OAuthSession{},
		&models.ShardBackup{},
	)
	if err != nil {
		t.Fatalf("failed to migrate database: %v", err)
	}
}

func TestRegisterAndLogin(t *testing.T) {
	setupTestDB(t)

	app := fiber.New()
	app.Post("/register", Register)
	app.Post("/verify", Verify)
	app.Post("/login", Login)
	app.Post("/refresh", Refresh)
	app.Post("/logout", Logout)
	app.Get("/protected", func(c *fiber.Ctx) error {
		userID := getUserID(c)
		if userID == 0 {
			return c.SendStatus(http.StatusUnauthorized)
		}
		return c.JSON(fiber.Map{"userId": userID})
	})

	authHash := hex.EncodeToString([]byte("Argon2idHashPlaceholderSecretValue"))

	// 1. Successful Register
	regReq := RegisterRequest{
		Username: "alice",
		AuthHash: authHash,
	}
	regBody, _ := json.Marshal(regReq)

	req := httptest.NewRequest("POST", "/register", bytes.NewReader(regBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Register request failed: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", resp.StatusCode)
	}

	// 2. Register Duplicate Username
	req = httptest.NewRequest("POST", "/register", bytes.NewReader(regBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("Register duplicate request failed: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status 400 for duplicate registration, got %d", resp.StatusCode)
	}

	// 3. Web credentials verification does not issue a mobile token
	loginReq := LoginRequest{
		Username: "alice",
		AuthHash: authHash,
	}
	loginBody, _ := json.Marshal(loginReq)

	req = httptest.NewRequest("POST", "/verify", bytes.NewReader(loginBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("Verify request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected verify status 200, got %d", resp.StatusCode)
	}
	var verifyResp VerifyResponse
	json.NewDecoder(resp.Body).Decode(&verifyResp)
	if verifyResp.UserID == 0 || verifyResp.Username != "alice" {
		t.Errorf("Unexpected verify response: %+v", verifyResp)
	}

	// 4. Short-lived BFF assertion authorizes a protected handler
	now := time.Now()
	bffToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"iss":       bffAssertionIssuer,
		"aud":       bffAssertionAudience,
		"sub":       "alice",
		"token_use": "bff",
		"iat":       now.Unix(),
		"exp":       now.Add(time.Minute).Unix(),
	})
	bffTokenString, err := bffToken.SignedString(getBFFJWTSecret())
	if err != nil {
		t.Fatalf("Failed to sign BFF assertion: %v", err)
	}
	req = httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+bffTokenString)
	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("Protected BFF request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected BFF assertion status 200, got %d", resp.StatusCode)
	}

	for name, claims := range map[string]jwt.MapClaims{
		"wrong token use": {
			"iss":       bffAssertionIssuer,
			"aud":       bffAssertionAudience,
			"sub":       "alice",
			"token_use": "mobile",
			"iat":       now.Unix(),
			"exp":       now.Add(time.Minute).Unix(),
		},
		"excessive lifetime": {
			"iss":       bffAssertionIssuer,
			"aud":       bffAssertionAudience,
			"sub":       "alice",
			"token_use": "bff",
			"iat":       now.Unix(),
			"exp":       now.Add(5 * time.Minute).Unix(),
		},
	} {
		t.Run(name, func(t *testing.T) {
			invalidToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
			invalidTokenString, err := invalidToken.SignedString(getBFFJWTSecret())
			if err != nil {
				t.Fatalf("Failed to sign invalid BFF assertion: %v", err)
			}
			req := httptest.NewRequest("GET", "/protected", nil)
			req.Header.Set("Authorization", "Bearer "+invalidTokenString)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("Invalid BFF request failed: %v", err)
			}
			if resp.StatusCode != http.StatusUnauthorized {
				t.Errorf("Expected invalid BFF assertion status 401, got %d", resp.StatusCode)
			}
		})
	}

	// 5. Successful mobile login
	req = httptest.NewRequest("POST", "/login", bytes.NewReader(loginBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("Login request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var loginResp TokenResponse
	json.NewDecoder(resp.Body).Decode(&loginResp)
	token := loginResp.Token
	if token == "" {
		t.Errorf("Expected JWT token in login response, got empty")
	}
	if loginResp.ExpiresAt == 0 {
		t.Errorf("Expected JWT expiry in login response, got zero")
	}

	// 6. Refresh while the token is valid
	req = httptest.NewRequest("POST", "/refresh", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("Refresh request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected refresh status 200, got %d", resp.StatusCode)
	}

	var refreshResp TokenResponse
	json.NewDecoder(resp.Body).Decode(&refreshResp)
	if refreshResp.Token == "" {
		t.Errorf("Expected refreshed JWT token, got empty")
	}

	// 7. Logout revokes the current auth version
	req = httptest.NewRequest("POST", "/logout", nil)
	req.Header.Set("Authorization", "Bearer "+refreshResp.Token)
	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("Logout request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected logout status 200, got %d", resp.StatusCode)
	}

	req = httptest.NewRequest("POST", "/refresh", nil)
	req.Header.Set("Authorization", "Bearer "+refreshResp.Token)
	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("Refresh after logout request failed: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("Expected refresh after logout status 401, got %d", resp.StatusCode)
	}

	// 8. Invalid Login Credentials
	loginReqWrong := LoginRequest{
		Username: "alice",
		AuthHash: hex.EncodeToString([]byte("WrongPasswordHash")),
	}
	loginWrongBody, _ := json.Marshal(loginReqWrong)

	req = httptest.NewRequest("POST", "/login", bytes.NewReader(loginWrongBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err = app.Test(req)
	if err != nil {
		t.Fatalf("Login request failed: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", resp.StatusCode)
	}
}
