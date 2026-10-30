ALTER TABLE collections ADD COLUMN IF NOT EXISTS image_id uuid REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS banner_id uuid REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address jsonb NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS collections_image_idx ON collections(image_id);
CREATE INDEX IF NOT EXISTS collections_banner_idx ON collections(banner_id);

CREATE TABLE IF NOT EXISTS staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_invitations_staff_idx ON staff_invitations(staff_id);
CREATE INDEX IF NOT EXISTS staff_invitations_expiry_idx ON staff_invitations(expires_at) WHERE accepted_at IS NULL;
