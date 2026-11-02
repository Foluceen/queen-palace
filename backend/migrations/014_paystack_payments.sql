ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_redirect_url text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_unique
  ON orders(payment_reference) WHERE payment_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS paystack_webhook_events (
  event_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','processed','rejected')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text
);
CREATE INDEX IF NOT EXISTS paystack_webhook_events_pending_idx
  ON paystack_webhook_events(next_attempt_at, received_at)
  WHERE status IN ('pending','processing');
