package handlers

import (
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"os"
	"strconv"
	"time"

	"golang.org/x/crypto/bcrypt"

	"aether-server/internal/db"
	"aether-server/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

const (
	bffAssertionIssuer   = "aether-web"
	bffAssertionAudience = "aether-api"
	bffAssertionMaxTTL   = 90 * time.Second
)

func getJWTSecret() []byte {
	secret := os.Getenv("GO_JWT_SECRET")
	if secret == "" {
		secret = os.Getenv("AUTH_JWT_SECRET")
	}
	return []byte(secret)
}

func getBFFJWTSecret() []byte {
	secret := os.Getenv("AETHER_BFF_JWT_SECRET")
	if secret == "" {
		secret = os.Getenv("GO_JWT_SECRET")
	}
	if secret == "" {
		secret = os.Getenv("AUTH_JWT_SECRET")
	}
	return []byte(secret)
}

type RegisterRequest struct {
	Username string `json:"username"`
	AuthHash string `json:"authHash"` // Hex encoded hash
}

type LoginRequest struct {
	Username string `json:"username"`
	AuthHash string `json:"authHash"` // Hex encoded hash
}

type TokenResponse struct {
	Token     string `json:"token"`
	ExpiresAt int64  `json:"expiresAt"`
}

type VerifyResponse struct {
	UserID   uint   `json:"userId"`
	Username string `json:"username"`
}

func getJWTTTL() time.Duration {
	raw := os.Getenv("GO_JWT_TTL_SECONDS")
	if raw == "" {
		return 72 * time.Hour
	}

	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return 72 * time.Hour
	}

	return time.Duration(seconds) * time.Second
}

func issueToken(user models.User) (TokenResponse, error) {
	if len(getJWTSecret()) == 0 {
		return TokenResponse{}, fiber.NewError(500, "Server auth secret is not configured")
	}

	authVersion := user.AuthVersion
	if authVersion == 0 {
		authVersion = 1
	}

	expiresAt := time.Now().Add(getJWTTTL()).Unix()
	claims := jwt.MapClaims{
		"user_id":      user.ID,
		"auth_version": authVersion,
		"iat":          time.Now().Unix(),
		"exp":          expiresAt,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(getJWTSecret())
	if err != nil {
		return TokenResponse{}, err
	}

	return TokenResponse{Token: signed, ExpiresAt: expiresAt}, nil
}

func Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	hashBytes, err := hex.DecodeString(req.AuthHash)
	if err != nil || len(hashBytes) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid auth hash format"})
	}

	var existingUser models.User
	if err := db.DB.Where("username = ?", req.Username).First(&existingUser).Error; err == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Username already exists"})
	}

	bcryptHash, err := bcrypt.GenerateFromPassword(hashBytes, 12)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to hash credentials"})
	}

	user := models.User{
		Username:        req.Username,
		AuthHash:        bcryptHash,
		AuthHashVersion: 2,
		AuthVersion:     1,
	}

	if result := db.DB.Create(&user); result.Error != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid data"})
	}

	return c.Status(201).JSON(fiber.Map{"message": "User registered successfully", "userId": user.ID})
}

func authenticateCredentials(req LoginRequest) (models.User, error) {
	var user models.User
	if err := db.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		return models.User{}, fiber.NewError(401, "Invalid credentials")
	}

	reqHashBytes, err := hex.DecodeString(req.AuthHash)
	if err != nil {
		return models.User{}, fiber.NewError(400, "Invalid auth hash format")
	}

	if user.AuthHashVersion == 1 || user.AuthHashVersion == 0 {
		if len(user.AuthHash) != len(reqHashBytes) {
			return models.User{}, fiber.NewError(401, "Invalid credentials")
		}
		if subtle.ConstantTimeCompare(user.AuthHash, reqHashBytes) != 1 {
			return models.User{}, fiber.NewError(401, "Invalid credentials")
		}

		// Transparently migrate to bcrypt
		bcryptHash, err := bcrypt.GenerateFromPassword(reqHashBytes, 12)
		if err == nil {
			user.AuthHash = bcryptHash
			user.AuthHashVersion = 2
			db.DB.Model(&user).Updates(map[string]interface{}{
				"auth_hash":         bcryptHash,
				"auth_hash_version": 2,
			})
		}
	} else if user.AuthHashVersion == 2 {
		if err := bcrypt.CompareHashAndPassword(user.AuthHash, reqHashBytes); err != nil {
			return models.User{}, fiber.NewError(401, "Invalid credentials")
		}
	} else {
		return models.User{}, fiber.NewError(401, "Invalid auth hash version")
	}

	return user, nil
}

func writeAuthError(c *fiber.Ctx, err error) error {
	var fiberErr *fiber.Error
	if errors.As(err, &fiberErr) {
		return c.Status(fiberErr.Code).JSON(fiber.Map{"error": fiberErr.Message})
	}
	return c.Status(500).JSON(fiber.Map{"error": "Authentication failed"})
}

func Verify(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	user, err := authenticateCredentials(req)
	if err != nil {
		return writeAuthError(c, err)
	}

	return c.JSON(VerifyResponse{UserID: user.ID, Username: user.Username})
}

func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	user, err := authenticateCredentials(req)
	if err != nil {
		return writeAuthError(c, err)
	}

	resp, err := issueToken(user)
	if err != nil {
		return writeAuthError(c, err)
	}

	return c.JSON(resp)
}

func Refresh(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var user models.User
	if err := db.DB.First(&user, userID).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	resp, err := issueToken(user)
	if err != nil {
		if fiberErr, ok := err.(*fiber.Error); ok {
			return c.Status(fiberErr.Code).JSON(fiber.Map{"error": fiberErr.Message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Could not refresh token"})
	}

	return c.JSON(resp)
}

func Logout(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	if err := db.DB.Model(&models.User{}).
		Where("id = ?", userID).
		UpdateColumn("auth_version", gorm.Expr("auth_version + ?", 1)).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not logout"})
	}

	return c.JSON(fiber.Map{"message": "Logged out"})
}

func authenticateBearerToken(tokenString string) uint {
	if userID := authenticateBFFAssertion(tokenString); userID != 0 {
		return userID
	}
	return authenticateMobileToken(tokenString)
}

func authenticateBFFAssertion(tokenString string) uint {
	secret := getBFFJWTSecret()
	if len(secret) == 0 {
		return 0
	}

	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(
		tokenString,
		claims,
		func(token *jwt.Token) (interface{}, error) {
			if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
				return nil, fiber.NewError(401, "Unexpected signing method")
			}
			return secret, nil
		},
		jwt.WithIssuer(bffAssertionIssuer),
		jwt.WithAudience(bffAssertionAudience),
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
	)
	if err != nil || !token.Valid {
		return 0
	}

	subject, err := claims.GetSubject()
	if err != nil || subject == "" {
		return 0
	}
	if tokenUse, ok := claims["token_use"].(string); !ok || tokenUse != "bff" {
		return 0
	}
	issuedAt, err := claims.GetIssuedAt()
	if err != nil || issuedAt == nil {
		return 0
	}
	expiresAt, err := claims.GetExpirationTime()
	if err != nil || expiresAt == nil {
		return 0
	}
	assertionTTL := expiresAt.Time.Sub(issuedAt.Time)
	if assertionTTL <= 0 || assertionTTL > bffAssertionMaxTTL {
		return 0
	}

	var user models.User
	if err := db.DB.Select("id").Where("username = ?", subject).First(&user).Error; err != nil {
		return 0
	}
	return user.ID
}

func authenticateMobileToken(tokenString string) uint {
	secret := getJWTSecret()
	if len(secret) == 0 {
		return 0
	}

	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(
		tokenString,
		claims,
		func(token *jwt.Token) (interface{}, error) {
			if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
				return nil, fiber.NewError(401, "Unexpected signing method")
			}
			return secret, nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
	)
	if err != nil || !token.Valid {
		return 0
	}

	idFloat, ok := claims["user_id"].(float64)
	if !ok {
		return 0
	}
	authVersionFloat, ok := claims["auth_version"].(float64)
	if !ok {
		return 0
	}

	var user models.User
	userID := uint(idFloat)
	tokenAuthVersion := uint(authVersionFloat)
	if err := db.DB.Select("id", "auth_version").First(&user, userID).Error; err != nil {
		return 0
	}
	if user.AuthVersion == 0 {
		user.AuthVersion = 1
		_ = db.DB.Model(&user).Update("auth_version", user.AuthVersion).Error
	}
	if tokenAuthVersion != user.AuthVersion {
		return 0
	}

	return userID
}
