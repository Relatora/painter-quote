-- Rooms are how quantities get entered. A painter picks or measures rooms, and the
-- surface areas fan out across every line item that coats that surface.

-- Which surface a price book item covers, so quantities map onto it explicitly.
-- NULL means the item is not driven by room measurements: doors and windows are
-- counted, gallons are derived, and fees are flat.
ALTER TABLE price_book_item ADD COLUMN surface TEXT;

CREATE TABLE quote_room (
  id           TEXT PRIMARY KEY,
  quote_id     TEXT NOT NULL REFERENCES quote(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  wall_sqft    REAL NOT NULL DEFAULT 0,
  ceiling_sqft REAL NOT NULL DEFAULT 0,
  trim_linft   REAL NOT NULL DEFAULT 0,
  -- Wall and ceiling rates are per coat, so this multiplies those areas.
  coats        INTEGER NOT NULL DEFAULT 2,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_quote_room_quote ON quote_room (quote_id, sort_order);

-- Backfill the seeded price book. Names match src/server/fixtures/seed-price-book.ts.
UPDATE price_book_item SET surface = 'wall' WHERE name IN (
  'Interior walls', 'Exterior siding', 'Priming', 'Wallpaper removal', 'Pressure washing'
);
UPDATE price_book_item SET surface = 'ceiling' WHERE name IN (
  'Ceilings', 'Popcorn ceiling removal'
);
UPDATE price_book_item SET surface = 'trim' WHERE name IN (
  'Trim and baseboard', 'Crown molding', 'Caulking', 'Exterior soffit and fascia'
);
