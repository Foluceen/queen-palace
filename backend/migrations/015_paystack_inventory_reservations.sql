ALTER TABLE order_lines
  ADD COLUMN IF NOT EXISTS inventory_variant_id uuid;

-- Preserve which stock row was reserved if an admin later deletes a variant;
-- variant_id itself is intentionally nullable for historical order display.
UPDATE order_lines
SET inventory_variant_id=variant_id
WHERE inventory_variant_id IS NULL AND variant_id IS NOT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS inventory_status text NOT NULL DEFAULT 'committed';

-- Existing checkout already decremented stock at order creation. Mark only
-- pending Paystack orders with a verifiable reference as reserved so they can
-- be released or committed without applying a second decrement.
UPDATE orders SET inventory_status='reserved'
WHERE payment_method='paystack' AND payment_status='pending' AND payment_reference IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='orders_inventory_status_check'
      AND conrelid='orders'::regclass
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_inventory_status_check
      CHECK (inventory_status IN ('reserved','committed','released','shortfall'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_pending_paystack_inventory_idx
  ON orders(created_at)
  WHERE payment_method='paystack'
    AND payment_status='pending'
    AND inventory_status='reserved';

COMMENT ON COLUMN orders.inventory_status IS
  'Stock was deducted at order creation; reserved is pending payment, committed is verified paid, released is failed/expired, shortfall is a verified late payment needing manual stock resolution.';
