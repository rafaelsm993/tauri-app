-- Allow Google users to share display names.
-- Password-based login uniqueness is enforced at the application layer
-- (only queries users WHERE password_hash IS NOT NULL).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
