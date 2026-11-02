export interface InventoryQueryResult {
  rowCount?: number | null;
  rows?: any[];
}

export interface InventoryDbClient {
  query(sql: string, params?: unknown[]): Promise<InventoryQueryResult>;
  release?: () => void;
}

export interface InventoryDbPool {
  connect(): Promise<InventoryDbClient>;
  query(sql: string, params?: unknown[]): Promise<InventoryQueryResult>;
}

type LockedOrder = {
  id: string;
  payment_method: string;
  payment_reference: string | null;
  total_kobo: string | number | bigint;
  payment_status: string;
  inventory_status: string;
};

type OrderLine = { product_id: string; variant_id: string | null; inventory_variant_id?: string | null; quantity: number };

async function inTransaction<T>(pool: Pick<InventoryDbPool, 'connect'>, work: (client: InventoryDbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release?.();
  }
}

function orderMatches(order: LockedOrder | undefined, id: string, reference: string, totalKobo?: number): order is LockedOrder {
  if (!order || order.id !== id || order.payment_method !== 'paystack' || order.payment_reference !== reference) return false;
  if (totalKobo !== undefined) {
    const amount = Number(order.total_kobo);
    if (!Number.isSafeInteger(amount) || amount !== totalKobo) return false;
  }
  return true;
}

async function restoreOrderStock(client: InventoryDbClient, orderId: string): Promise<void> {
  await client.query(`UPDATE product_variants v
    SET stock=v.stock+line.quantity,updated_at=now()
    FROM (SELECT COALESCE(inventory_variant_id,variant_id) AS variant_id,SUM(quantity)::int AS quantity FROM order_lines
      WHERE order_id=$1 AND COALESCE(inventory_variant_id,variant_id) IS NOT NULL GROUP BY COALESCE(inventory_variant_id,variant_id)) line
    WHERE v.id=line.variant_id`, [orderId]);
  await client.query(`UPDATE products p
    SET stock=p.stock+line.quantity,updated_at=now()
    FROM (SELECT product_id,SUM(quantity)::int AS quantity FROM order_lines
      WHERE order_id=$1 AND COALESCE(inventory_variant_id,variant_id) IS NULL GROUP BY product_id) line
    WHERE p.id=line.product_id`, [orderId]);
}

export async function releasePaystackOrderInventory(pool: Pick<InventoryDbPool, 'connect'>, orderId: string, reference: string): Promise<boolean> {
  return inTransaction(pool, async (client) => {
    const found = await client.query(
      'SELECT id,payment_method,payment_reference,total_kobo,payment_status,inventory_status FROM orders WHERE id=$1 FOR UPDATE',
      [orderId],
    );
    const order = found.rows?.[0] as LockedOrder | undefined;
    if (!orderMatches(order, orderId, reference) || order.payment_status !== 'pending' || order.inventory_status !== 'reserved') return false;

    await restoreOrderStock(client, orderId);
    const updated = await client.query(
      "UPDATE orders SET payment_status='failed',inventory_status='released' WHERE id=$1 AND payment_method='paystack' AND payment_reference=$2 AND payment_status='pending' AND inventory_status='reserved' RETURNING id",
      [orderId, reference],
    );
    if ((updated.rowCount || 0) !== 1) throw new Error('Inventory release lost its order-state guard');
    return true;
  });
}

async function reacquireOrderStock(client: InventoryDbClient, orderId: string): Promise<boolean> {
  const linesResult = await client.query(
    'SELECT product_id,COALESCE(inventory_variant_id,variant_id) AS variant_id,quantity FROM order_lines WHERE order_id=$1 ORDER BY COALESCE(inventory_variant_id,variant_id) NULLS FIRST,product_id',
    [orderId],
  );
  const lines = (linesResult.rows || []) as OrderLine[];
  for (const line of lines) {
    const quantity = Number(line.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) return false;
    const table = line.variant_id ? 'product_variants' : 'products';
    const id = line.variant_id || line.product_id;
    const result = await client.query(
      `UPDATE ${table} SET stock=stock-$1,updated_at=now() WHERE id=$2 AND stock >= $1 RETURNING id`,
      [quantity, id],
    );
    if ((result.rowCount || 0) !== 1) return false;
  }
  return true;
}

export async function commitPaystackOrderInventory(
  pool: Pick<InventoryDbPool, 'connect'>,
  orderId: string,
  reference: string,
  totalKobo: number,
): Promise<boolean> {
  return inTransaction(pool, async (client) => {
    const found = await client.query(
      'SELECT id,payment_method,payment_reference,total_kobo,payment_status,inventory_status FROM orders WHERE id=$1 FOR UPDATE',
      [orderId],
    );
    const order = found.rows?.[0] as LockedOrder | undefined;
    if (!orderMatches(order, orderId, reference, totalKobo)) return false;

    if (order.payment_status === 'paid') return order.inventory_status === 'committed' || order.inventory_status === 'shortfall';
    const lateReleasedPayment = order.payment_status === 'failed' && order.inventory_status === 'released';
    if (order.payment_status !== 'pending' && !lateReleasedPayment) return false;

    let inventoryStatus = order.inventory_status;
    if (inventoryStatus === 'released') {
      await client.query('SAVEPOINT inventory_reacquire');
      const reacquired = await reacquireOrderStock(client, orderId);
      if (!reacquired) {
        await client.query('ROLLBACK TO SAVEPOINT inventory_reacquire');
        inventoryStatus = 'shortfall';
      } else {
        inventoryStatus = 'committed';
      }
    } else if (inventoryStatus === 'reserved' || inventoryStatus === 'committed') {
      inventoryStatus = 'committed';
    } else if (inventoryStatus === 'shortfall') {
      inventoryStatus = 'shortfall';
    } else {
      return false;
    }

    const updated = await client.query(
      "UPDATE orders SET payment_status='paid',inventory_status=$4,paid_at=COALESCE(paid_at,now()) WHERE id=$1 AND payment_method='paystack' AND payment_reference=$2 AND total_kobo=$3 AND payment_status=$5 AND inventory_status=$6 RETURNING id",
      [orderId, reference, totalKobo, inventoryStatus, order.payment_status, order.inventory_status],
    );
    if ((updated.rowCount || 0) !== 1) throw new Error('Verified payment lost its order-state guard');
    return true;
  });
}
