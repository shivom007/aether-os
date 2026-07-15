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

	var chunks []models.Chunk
	db.Find(&chunks)

	for _, c := range chunks {
		fmt.Printf("Chunk %d: DataShards=%d, ParityShards=%d\n", c.ID, c.DataShards, c.ParityShards)
	}
}
