-- Aether-OS initial schema
-- All tables use UUIDs and are designed to be portable to CockroachDB.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- USERS & AUTH
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,           -- scrypt(password)
  salt_b64      TEXT NOT NULL,           -- salt used by the client to derive master key (zero-knowledge)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,       -- sha256 of refresh token
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- =========================================================
-- VOLUMES (logical buckets)
-- =========================================================
CREATE TABLE IF NOT EXISTS volumes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  -- Fingerprint of the user's master key. We NEVER store the key itself.
  -- Used only to verify a returning user supplied the correct key.
  master_key_fingerprint TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, name)
);
CREATE INDEX IF NOT EXISTS idx_volumes_owner ON volumes(owner_id);

-- =========================================================
-- INODES (files + directories)
-- =========================================================
CREATE TABLE IF NOT EXISTS inodes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volume_id         UUID NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
  parent_id         UUID REFERENCES inodes(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('file','dir')),
  size_bytes        BIGINT NOT NULL DEFAULT 0,
  mime_type         TEXT,
  materialized_path TEXT NOT NULL,       -- e.g. "/documents/report.pdf"
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inodes_volume        ON inodes(volume_id);
CREATE INDEX IF NOT EXISTS idx_inodes_parent        ON inodes(volume_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_inodes_path          ON inodes(volume_id, materialized_path);

-- =========================================================
-- PROVIDER CREDENTIALS
-- =========================================================
CREATE TABLE IF NOT EXISTS provider_credentials (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_type          TEXT NOT NULL CHECK (provider_type IN ('s3','gcs','azure','b2')),
  endpoint_url           TEXT,
  bucket                 TEXT NOT NULL,
  region                 TEXT,
  -- Encrypted access token: AES-256-GCM envelope produced client-side,
  -- then re-wrapped server-side with SERVER_WRAPPING_KEY_B64.
  encrypted_access_token BYTEA NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy','unhealthy','unknown')),
  last_checked_at        TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_providers_owner ON provider_credentials(owner_id);

-- =========================================================
-- PHYSICAL CHUNKS (erasure-coded shards of a logical chunk)
-- =========================================================
-- A logical chunk is 1 MB of encrypted plaintext.
-- Reed-Solomon 4+2 produces 6 shards; each becomes a physical_chunk row.
CREATE TABLE IF NOT EXISTS physical_chunks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inode_id          UUID NOT NULL REFERENCES inodes(id) ON DELETE CASCADE,
  chunk_index       INTEGER NOT NULL,       -- which 1MB block of the file
  shard_index       INTEGER NOT NULL,       -- 0..5  (0-3 data, 4-5 parity)
  provider_id       UUID REFERENCES provider_credentials(id) ON DELETE SET NULL,
  remote_object_id  TEXT NOT NULL,          -- object key in the remote bucket
  checksum_sha256   TEXT NOT NULL,
  size_bytes        INTEGER NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(inode_id, chunk_index, shard_index)
);
CREATE INDEX IF NOT EXISTS idx_chunks_inode ON physical_chunks(inode_id);

-- =========================================================
-- JOB QUEUE (chunk encode+upload pipeline)
-- =========================================================
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inode_id      UUID NOT NULL REFERENCES inodes(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','encoding','uploading','complete','failed')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  worker_id     UUID,
  -- encrypted ciphertext for this 1MB chunk (already AES-GCM encrypted client-side)
  payload       BYTEA,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_jobs_status  ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_inode   ON jobs(inode_id);

-- =========================================================
-- WORKERS (registered in-process worker pool nodes)
-- =========================================================
CREATE TABLE IF NOT EXISTS workers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id         TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'idle'
                  CHECK (status IN ('idle','processing','error','offline')),
  jobs_processed  BIGINT NOT NULL DEFAULT 0,
  cpu_percent     REAL NOT NULL DEFAULT 0,
  memory_percent  REAL NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- EVENT LOG (NATS-subject mirror, bridged to SSE)
-- =========================================================
-- The Postgres LISTEN/NOTIFY channel is 'aether_events'.
-- Each row's `subject` matches the NATS subject spec (e.g. aether.jobs.uploading).
CREATE TABLE IF NOT EXISTS events (
  id         BIGSERIAL PRIMARY KEY,
  subject    TEXT NOT NULL,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_subject ON events(subject, created_at DESC);

-- =========================================================
-- PAUSE STATE (global worker pool toggle)
-- =========================================================
CREATE TABLE IF NOT EXISTS system_state (
  k TEXT PRIMARY KEY,
  v JSONB NOT NULL
);
INSERT INTO system_state(k, v) VALUES ('worker_pool_paused', 'false'::jsonb)
  ON CONFLICT (k) DO NOTHING;
