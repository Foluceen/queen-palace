CREATE UNIQUE INDEX IF NOT EXISTS reviews_product_email_unique ON reviews(product_id,lower(email));
