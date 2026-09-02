-- Photos live in R2. This table stores only the object key and metadata.
-- Image bytes never go in D1: rows would balloon, queries would slow, and the
-- 1MB per-value limit would reject anything but a thumbnail.

CREATE TABLE quote_photo (
  id           TEXT PRIMARY KEY,
  quote_id     TEXT NOT NULL REFERENCES quote(id) ON DELETE CASCADE,
  r2_key       TEXT NOT NULL,
  content_type TEXT NOT NULL,
  width        INTEGER,
  height       INTEGER,
  byte_size    INTEGER,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_quote_photo_quote ON quote_photo (quote_id, sort_order);
