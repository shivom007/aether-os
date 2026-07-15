package main

import (
	"log"
	"aether-server/internal/db"
	"aether-server/internal/models"
)

func main() {
	db.InitDB()
	res := db.DB.Model(&models.User{}).Where("1 = 1").Updates(map[string]interface{}{"is_premium": true, "r2_backup_enabled": true})
	if res.Error != nil {
		log.Fatal(res.Error)
	}
	log.Printf("Updated %d users to premium", res.RowsAffected)
}
