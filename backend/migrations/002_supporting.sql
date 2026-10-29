-- Additive supporting schema for contract-backed features.
-- This migration is intentionally not applied to production in this phase.
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label text NOT NULL, recipient text NOT NULL, line1 text NOT NULL, line2 text NOT NULL DEFAULT '', city text NOT NULL,
  state text NOT NULL, postal_code text NOT NULL DEFAULT '', country text NOT NULL DEFAULT 'Nigeria', phone text NOT NULL,
  is_default boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_addresses_customer_idx ON customer_addresses(customer_id);
CREATE TABLE IF NOT EXISTS wishlists (customer_id uuid PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE, product_ids jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS discounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, kind text NOT NULL CHECK(kind IN ('percentage','fixed')), value bigint NOT NULL CHECK(value>=0), active boolean NOT NULL DEFAULT true, starts_at timestamptz, ends_at timestamptz, usage_limit int, usage_count int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS cart_discounts (cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE, discount_id uuid NOT NULL REFERENCES discounts(id), PRIMARY KEY(cart_id,discount_id));
CREATE TABLE IF NOT EXISTS media (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), file_name text NOT NULL, mime_type text NOT NULL, size_bytes bigint NOT NULL CHECK(size_bytes>=0), width int NOT NULL DEFAULT 0, height int NOT NULL DEFAULT 0, alt text NOT NULL DEFAULT '', tags jsonb NOT NULL DEFAULT '[]', data_url text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS product_types (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE NOT NULL, options jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS inventory_adjustments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), delta int NOT NULL, reason text NOT NULL, staff_id uuid REFERENCES staff(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS order_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE, kind text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
