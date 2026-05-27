package handlers

import (
	"encoding/hex"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"aether-server/internal/db"
	"aether-server/internal/models"
)

var jwtSecret = []byte("super-secret-key-for-mvp") // In prod, load from env

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

	// Compare hashes (constant time comparison is better in prod, but simple slice comparison works for MVP)
	if len(user.AuthHash) != len(reqHashBytes) {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}
	for i := range user.AuthHash {
		if user.AuthHash[i] != reqHashBytes[i] {
			return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
		}
	}

	// Create JWT token
	claims := jwt.MapClaims{
		"user_id": user.ID,
		"exp":     time.Now().Add(time.Hour * 72).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, err := token.SignedString(jwtSecret)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not login"})
	}

	return c.JSON(fiber.Map{"token": t})
}
