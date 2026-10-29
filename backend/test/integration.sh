#!/usr/bin/env bash
set -euo pipefail
name=queen-palace-test-db-verify
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; [[ -n "${srv:-}" ]] && kill "$srv" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=queen_palace_test -p 55432:5432 postgres:16-alpine >/dev/null
until docker exec "$name" pg_isready -U postgres -d queen_palace_test >/dev/null 2>&1; do sleep 1; done
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/queen_palace_test
npm run migrate
npm run seed
docker exec "$name" psql -U postgres -d queen_palace_test -c "insert into products(handle,title,status,price_kobo,stock) values ('integration-product','Integration Product','published',125000,3) on conflict(handle) do update set stock=3" >/dev/null
HOST=127.0.0.1 PORT=4401 node dist/server.js >/tmp/qp-server.log 2>&1 & srv=$!
until curl -fsS http://127.0.0.1:4401/health/ready >/dev/null 2>&1; do sleep 1; done
base=http://127.0.0.1:4401/v1
email="integration-$(date +%s)@example.test"
reg=$(curl -fsS -c /tmp/qp-cookie -H 'content-type: application/json' -d "{\"firstName\":\"Test\",\"lastName\":\"Customer\",\"email\":\"$email\",\"password\":\"StrongPass123!\",\"marketingOptIn\":false}" "$base/customers/auth/register")
product=$(docker exec "$name" psql -U postgres -d queen_palace_test -Atc "select id from products where status='published' limit 1")
stock_before=$(docker exec "$name" psql -U postgres -d queen_palace_test -Atc "select stock from products where id='$product'")
curl -fsS -c /tmp/qp-cookie -H 'content-type: application/json' -d '{}' "$base/carts" >/tmp/cart.json
cartid=$(jq -r .id /tmp/cart.json)
added=$(curl -fsS -b /tmp/qp-cookie -H 'content-type: application/json' -d "{\"lines\":[{\"productId\":\"$product\",\"quantity\":1}]}" "$base/carts/$cartid/lines")
key="integration-key-$(date +%s)"
order=$(curl -fsS -b /tmp/qp-cookie -H 'content-type: application/json' -d "{\"cartId\":\"$cartid\",\"contact\":{\"email\":\"$email\",\"phone\":\"08000000000\",\"marketingOptIn\":false},\"shippingAddress\":{\"line1\":\"Test\",\"city\":\"Ilesha\",\"state\":\"Osun\",\"country\":\"NG\"},\"shippingRateId\":\"local\",\"paymentMethod\":\"pay_on_delivery\",\"idempotencyKey\":\"$key\"}" "$base/checkout")
stock_after=$(docker exec "$name" psql -U postgres -d queen_palace_test -Atc "select stock from products where id='$product'")
orders=$(docker exec "$name" psql -U postgres -d queen_palace_test -Atc "select count(*) from orders")
replay=$(curl -fsS -b /tmp/qp-cookie -H 'content-type: application/json' -d "{\"cartId\":\"$cartid\",\"contact\":{\"email\":\"$email\",\"phone\":\"08000000000\",\"marketingOptIn\":false},\"shippingAddress\":{\"line1\":\"Test\",\"city\":\"Ilesha\",\"state\":\"Osun\",\"country\":\"NG\"},\"shippingRateId\":\"local\",\"paymentMethod\":\"pay_on_delivery\",\"idempotencyKey\":\"$key\"}" "$base/checkout")
number=$(printf '%s' "$order" | jq -r '.order.number')
token=$(printf '%s' "$order" | jq -r '.order.accessToken')
retrieved=$(curl -fsS "$base/orders/$number?token=$token")
unauthorized_status=$(curl -sS -o /tmp/qp-unauthorized.json -w '%{http_code}' "$base/orders/$number")
printf 'REGISTER=%s\nADDED=%s\nORDER=%s\nREPLAY=%s\nRETRIEVED=%s\nUNAUTHORIZED_STATUS=%s\nSTOCK_BEFORE=%s STOCK_AFTER=%s ORDERS=%s\n' "$reg" "$added" "$order" "$replay" "$retrieved" "$unauthorized_status" "$stock_before" "$stock_after" "$orders"
