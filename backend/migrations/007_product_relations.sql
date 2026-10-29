ALTER TABLE product_types ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS option_names jsonb NOT NULL DEFAULT '[]';
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type_id uuid REFERENCES product_types(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_poster_id uuid REFERENCES media(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku text UNIQUE, title text NOT NULL DEFAULT 'Default', options jsonb NOT NULL DEFAULT '{}',
  price_kobo bigint NOT NULL CHECK(price_kobo>=0), compare_at_kobo bigint,
  stock int NOT NULL DEFAULT 0 CHECK(stock>=0), policy text NOT NULL DEFAULT 'deny' CHECK(policy IN ('deny','continue')),
  low_stock_threshold int NOT NULL DEFAULT 5, media_id uuid REFERENCES media(id) ON DELETE SET NULL,
  position int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON product_variants(product_id, position);
CREATE TABLE IF NOT EXISTS product_media (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY(product_id,media_id)
);
