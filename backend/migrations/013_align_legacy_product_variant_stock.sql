-- Align legacy product-level values with the single default variant the shop reads.
INSERT INTO product_variants(product_id,sku,title,price_kobo,compare_at_kobo,stock,options,policy,low_stock_threshold,position)
SELECT p.id,p.sku,'Default',p.price_kobo,p.compare_at_kobo,p.stock,'{}','deny',5,0
FROM products p
WHERE NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id=p.id);

UPDATE product_variants v
SET price_kobo=p.price_kobo,
    compare_at_kobo=p.compare_at_kobo,
    stock=p.stock,
    updated_at=now()
FROM products p
WHERE p.id=v.product_id
  AND v.position=0
  AND (SELECT count(*) FROM product_variants vx WHERE vx.product_id=p.id)=1;
