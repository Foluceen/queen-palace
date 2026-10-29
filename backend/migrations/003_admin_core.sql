ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'unfulfilled';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'pay_on_delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_kobo bigint NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason text;
CREATE TABLE IF NOT EXISTS inventory_adjustments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), delta int NOT NULL, reason text NOT NULL, staff_id uuid REFERENCES staff(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS order_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE, staff_id uuid REFERENCES staff(id), message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS inventory_adjustments_product_idx ON inventory_adjustments(product_id, created_at DESC);
