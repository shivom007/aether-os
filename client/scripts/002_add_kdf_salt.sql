-- Add kdf_salt to volumes so a returning user can re-derive the master key
-- from their passphrase. Still zero-knowledge: the salt alone reveals nothing.
ALTER TABLE volumes
  ADD COLUMN IF NOT EXISTS kdf_salt TEXT;
