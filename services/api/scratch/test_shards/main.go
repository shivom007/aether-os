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

	var shards []models.Shard
	db.Order("id desc").Limit(20).Find(&shards)

	for _, s := range shards {
		fmt.Printf("Shard %d: Provider=%s, Status=%s\n", s.ID, s.Provider, s.Status)
	}
}
