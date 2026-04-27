CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist_items (
    user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id    BIGINT      NOT NULL,
    item_data   JSONB       NOT NULL,
    PRIMARY KEY (user_id, media_id)
);
