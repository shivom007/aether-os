package handlers

import (
	"github.com/gofiber/fiber/v2"
	"aether-server/internal/db"
	"aether-server/internal/models"
)

type CreateVolumeRequest struct {
	ID                   string `json:"id"`
	Name                 string `json:"name"`
	Description          string `json:"description"`
	MasterKeyFingerprint string `json:"master_key_fingerprint"`
	KdfSalt              string `json:"kdf_salt"`
}

type UpdateVolumeRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
}

func CreateVolume(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req CreateVolumeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	vol := models.Volume{
		ID:                   req.ID,
		UserID:               userID,
		Name:                 req.Name,
		Description:          req.Description,
		MasterKeyFingerprint: req.MasterKeyFingerprint,
		KdfSalt:              req.KdfSalt,
	}

	if err := db.DB.Create(&vol).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create volume"})
	}

	return c.Status(201).JSON(vol)
}

func ListVolumes(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var volumes []models.Volume
	db.DB.Where("user_id = ?", userID).Find(&volumes)

	// Since we don't store inode_count or size on the Volume itself,
	// for now we'll just return the volumes as-is. The Next.js API can map them.
	return c.JSON(volumes)
}

func UpdateVolume(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	id := c.Params("id")

	var req UpdateVolumeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var vol models.Volume
	if err := db.DB.Where("id = ? AND user_id = ?", id, userID).First(&vol).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Volume not found"})
	}

	if req.Name != nil {
		vol.Name = *req.Name
	}
	if req.Description != nil {
		vol.Description = *req.Description
	}

	db.DB.Save(&vol)
	return c.JSON(vol)
}

func DeleteVolume(c *fiber.Ctx) error {
	userID := getUserID(c)
	if userID == 0 {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	id := c.Params("id")

	// Verify volume exists and belongs to user
	var vol models.Volume
	if err := db.DB.Where("id = ? AND user_id = ?", id, userID).First(&vol).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Volume not found"})
	}

	// For a complete implementation we should delete all files inside the volume.
	// For now, we'll just delete the volume record and let files be orphaned or cascade deleted.
	db.DB.Delete(&vol)
	return c.JSON(fiber.Map{"deleted": id})
}
