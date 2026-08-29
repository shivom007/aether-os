package models

import (
	"time"
)

// User represents a registered user.
// In a Zero-Knowledge system, we only store the HashA for auth.
type User struct {
	ID              uint   `gorm:"primaryKey"`
	Username        string `gorm:"uniqueIndex;not null"`
	AuthHash        []byte `gorm:"not null"` // HashA from Argon2id
	AuthHashVersion uint   `gorm:"not null;default:1" json:"-"`
	AuthVersion     uint   `gorm:"not null;default:1" json:"-"`
	IsPremium       bool   `gorm:"default:false" json:"isPremium"`
	R2BackupEnabled bool   `gorm:"default:false" json:"r2BackupEnabled"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// ShardBackup represents a copy of a Shard stored in Aether's R2 fallback storage.
type ShardBackup struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ShardID   uint      `gorm:"uniqueIndex;not null" json:"shardId"`
	ObjectKey string    `gorm:"not null" json:"objectKey"` // R2 file key
	CreatedAt time.Time `json:"createdAt"`
}

// Volume represents an encrypted container.
type Volume struct {
	ID                   string    `gorm:"primaryKey;type:varchar(255)" json:"id"`
	UserID               uint      `gorm:"not null;index" json:"userId"`
	Name                 string    `gorm:"not null" json:"name"`
	Description          string    `json:"description"`
	MasterKeyFingerprint string    `json:"masterKeyFingerprint"`
	KdfSalt              string    `json:"kdfSalt"`
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

// Folder represents a virtual directory.
type Folder struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"userId"`
	VolumeID  string    `gorm:"not null;default:'default';index" json:"volumeId"`
	ParentID  *uint     `gorm:"index" json:"parentId"`
	Name      string    `gorm:"not null" json:"name"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	// Relationships
	Parent     *Folder  `gorm:"foreignKey:ParentID" json:"-"`
	Subfolders []Folder `gorm:"foreignKey:ParentID" json:"subfolders,omitempty"`
	Files      []File   `gorm:"foreignKey:FolderID" json:"files,omitempty"`
}

type File struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	UserID        uint      `gorm:"not null;index" json:"userId"`
	VolumeID      string    `gorm:"not null;default:'default';index" json:"volumeId"`
	FolderID      *uint     `gorm:"index" json:"folderId"`
	Name          string    `gorm:"not null" json:"name"`
	Size          int64     `gorm:"not null" json:"size"`
	MimeType      string    `json:"mimeType"`
	Thumbnail     string    `json:"thumbnail,omitempty"`
	Fingerprint   string    `json:"fingerprint,omitempty"` // Used for resumable uploads
	MediaMetadata string    `gorm:"type:text" json:"mediaMetadata,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`

	Versions []FileVersion `gorm:"foreignKey:FileID" json:"versions,omitempty"`
}

// FileVersion represents a specific version of a file.
type FileVersion struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	FileID    uint      `gorm:"not null;index" json:"fileId"`
	Version   int       `gorm:"not null" json:"version"`
	Size      int64     `gorm:"not null" json:"size"`
	CreatedAt time.Time `json:"createdAt"`

	Chunks []Chunk `gorm:"foreignKey:FileVersionID" json:"chunks,omitempty"`
}

// Chunk represents a 64MB piece of a FileVersion, split before erasure coding.
type Chunk struct {
	ID            uint  `gorm:"primaryKey" json:"id"`
	FileVersionID uint  `gorm:"not null;index" json:"fileVersionId"`
	ChunkIndex    int   `gorm:"not null" json:"chunkIndex"`
	Size          int64 `gorm:"not null" json:"size"`
	DataShards    int   `gorm:"not null;default:10" json:"dataShards"`
	ParityShards  int   `gorm:"not null;default:4" json:"parityShards"`

	Shards []Shard `gorm:"foreignKey:ChunkID" json:"shards,omitempty"`
}

// Shard represents one of the 14 Reed-Solomon pieces stored on a Cloud Provider.
type Shard struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	ChunkID        uint      `gorm:"not null;index" json:"chunkId"`
	ShardIndex     int       `gorm:"not null" json:"shardIndex"`      // 0-9 for data, 10-13 for parity
	Provider       string    `gorm:"not null" json:"provider"`        // e.g. "GoogleDrive", "Dropbox"
	ProviderFileID string    `gorm:"not null" json:"providerFileId"`  // ID of the shard file on the provider
	Status         string    `gorm:"default:'healthy'" json:"status"` // 'healthy', 'missing', 'corrupted'
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// UserProvider stores the linked cloud providers and their configurations.
// In MVP Config is JSON, in production it must be encrypted.
type UserProvider struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	UserID        uint       `gorm:"not null;index" json:"userId"`
	Provider      string     `gorm:"not null" json:"provider"`
	Config        string     `gorm:"not null" json:"-"`
	Status        string     `gorm:"not null;default:unknown" json:"status"`
	LastCheckedAt *time.Time `json:"lastCheckedAt"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

// OAuthSession stores temporary states to prevent leaking JWT in OAuth redirects.
type OAuthSession struct {
	ID        string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"userId"`
	Provider  string    `gorm:"not null" json:"provider"`
	CreatedAt time.Time `json:"createdAt"`
}
