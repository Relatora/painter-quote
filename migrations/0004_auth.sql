-- Magic link authentication. The contractor row is the user: a painter signs in with
-- their email and that email identifies their business, price book, and quotes.

-- Email becomes the login identity. Partial index so the existing demo contractor,
-- which has no email, does not collide with a future NULL.
CREATE UNIQUE INDEX idx_contractor_email ON contractor (email) WHERE email IS NOT NULL;

CREATE TABLE login_token (
  -- The SHA-256 of the token, never the token itself. Someone who reads this table
  -- must not be able to sign in as anybody: they would need the preimage.
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  -- Set on first use. A magic link is single use, so an old email in a mailbox,
  -- or a link leaked through a referrer, cannot be replayed.
  used_at    TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_login_token_expiry ON login_token (expires_at);
