package handlers

import (
	"crypto/subtle"
	"encoding/hex"
	"os"
	"time"

	"aether-server/internal/db"
	"aether-server/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func getJWTSecret() []byte {
	secret := os.Getenv("GO_JWT_SECRET")
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

	user := models.User{
		Username: req.Username,
		AuthHash: hashBytes,
	}

	if result := db.DB.Create(&user); result.Error != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid data"})
	}

	return c.Status(201).JSON(fiber.Map{"message": "User registered successfully", "userId": user.ID})
}

func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var user models.User
	if err := db.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	reqHashBytes, err := hex.DecodeString(req.AuthHash)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid auth hash format"})
	}

	if len(getJWTSecret()) == 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Server auth secret is not configured"})
	}

	if len(user.AuthHash) != len(reqHashBytes) {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}
	if subtle.ConstantTimeCompare(user.AuthHash, reqHashBytes) != 1 {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	// Create JWT token
	claims := jwt.MapClaims{
		"user_id": user.ID,
		"exp":     time.Now().Add(time.Hour * 72).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, err := token.SignedString(getJWTSecret())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not login"})
	}

	return c.JSON(fiber.Map{"token": t})
}
