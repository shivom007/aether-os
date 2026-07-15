package main

import (
	"fmt"
	"log"
	"aether-server/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func main() {
	db, err := gorm.Open(sqlite.Open("aether.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var ups []models.UserProvider
	db.Find(&ups)

	for _, up := range ups {
		fmt.Printf("UserProvider %d: User=%d, Provider=%s\n", up.ID, up.UserID, up.Provider)
	}
}
