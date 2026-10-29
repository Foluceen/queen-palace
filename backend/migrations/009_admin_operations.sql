CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS content_pages (
  slug text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  intro text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]',
  reviewed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT 'other';
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS order_number text;
CREATE TABLE IF NOT EXISTS inquiry_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), inquiry_id uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  author text NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS min_subtotal bigint NOT NULL DEFAULT 0;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS applies_to jsonb NOT NULL DEFAULT '{"type":"all"}';
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS once_per_customer boolean NOT NULL DEFAULT false;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
