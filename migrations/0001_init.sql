-- Money is stored as INTEGER cents everywhere. Never REAL: binary floating point
-- cannot represent 0.1 exactly, and a quote is a document someone pays against.
-- Tax is stored as INTEGER basis points (825 = 8.25%) for the same reason.
-- Quantities ARE REAL, because 12.5 linear feet and 1.5 hours are legitimate.

CREATE TABLE contractor (
  id                  TEXT PRIMARY KEY,
  company_name        TEXT NOT NULL,
  owner_name          TEXT,
  email               TEXT,
  phone               TEXT,
  address             TEXT,
  logo_key            TEXT,
  tax_rate_bps        INTEGER NOT NULL DEFAULT 0,
  job_minimum_cents   INTEGER NOT NULL DEFAULT 0,
  quote_terms         TEXT,
  quote_validity_days INTEGER NOT NULL DEFAULT 30,
  next_quote_number   INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL
);

CREATE TABLE price_book_item (
  id               TEXT PRIMARY KEY,
  contractor_id    TEXT NOT NULL REFERENCES contractor(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  -- labor | material | prep | fee
  category         TEXT NOT NULL,
  -- sqft | linft | unit | hour | gallon | flat
  unit_type        TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  -- 1 = seeded default the contractor has not confirmed yet. Renders as a
  -- "your price?" placeholder and must be confirmed before a quote finalizes.
  is_default       INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  archived         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_price_book_contractor ON price_book_item (contractor_id, archived, sort_order);

CREATE TABLE quote (
  id                  TEXT PRIMARY KEY,
  contractor_id       TEXT NOT NULL REFERENCES contractor(id) ON DELETE CASCADE,
  quote_number        TEXT NOT NULL,
  title               TEXT NOT NULL,
  customer_name       TEXT,
  customer_email      TEXT,
  customer_phone      TEXT,
  job_address         TEXT,
  -- draft | sent | accepted | declined
  status              TEXT NOT NULL DEFAULT 'draft',
  notes               TEXT,
  terms               TEXT,
  -- Snapshotted from the contractor at creation. A quote must never change
  -- retroactively because a setting changed after it was sent.
  tax_rate_bps        INTEGER NOT NULL DEFAULT 0,
  job_minimum_cents   INTEGER NOT NULL DEFAULT 0,
  -- Unguessable token for the public customer-facing view.
  public_token        TEXT NOT NULL UNIQUE,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  expires_at          TEXT
);

CREATE INDEX idx_quote_contractor ON quote (contractor_id, created_at DESC);

CREATE TABLE quote_line_item (
  id                  TEXT PRIMARY KEY,
  quote_id            TEXT NOT NULL REFERENCES quote(id) ON DELETE CASCADE,
  -- Nullable: a line may be typed ad hoc without a price book entry behind it.
  price_book_item_id  TEXT,
  name                TEXT NOT NULL,
  description         TEXT,
  category            TEXT NOT NULL,
  unit_type           TEXT NOT NULL,
  quantity            REAL NOT NULL DEFAULT 1,
  unit_price_cents    INTEGER NOT NULL,
  -- 1 = price came from an unconfirmed seed default; blocks finalizing.
  is_price_unconfirmed INTEGER NOT NULL DEFAULT 0,
  sort_order          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_line_item_quote ON quote_line_item (quote_id, sort_order);
