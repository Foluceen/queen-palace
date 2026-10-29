ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS verified_purchase boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS reviews_product_status_created_idx ON reviews(product_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_customer_created_idx ON reviews(customer_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_product_email_unique ON reviews(product_id,lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS reviews_customer_product_unique ON reviews(customer_id,product_id) WHERE customer_id IS NOT NULL;
