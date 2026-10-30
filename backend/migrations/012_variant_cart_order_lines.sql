ALTER TABLE cart_lines ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE cart_lines DROP CONSTRAINT IF EXISTS cart_lines_cart_id_product_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS cart_lines_variant_identity_idx ON cart_lines(cart_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS cart_lines_variant_idx ON cart_lines(variant_id);
CREATE INDEX IF NOT EXISTS order_lines_variant_idx ON order_lines(variant_id);
