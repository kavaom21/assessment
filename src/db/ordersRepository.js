import { pools } from './shardPools.js';

const INSERT_SQL = `
  INSERT INTO orders (order_id, customer_id, order_date, order_amount, status)
  SELECT * FROM UNNEST($1::text[], $2::text[], $3::timestamptz[], $4::numeric[], $5::text[])
  ON CONFLICT (order_id) DO NOTHING
`;


export async function insertBatch(shardIndex, rows) {
  if (rows.length === 0) return 0;

  const orderIds = [], customerIds = [], dates = [], amounts = [], statuses = [];
  for (const r of rows) {
    orderIds.push(r.order_id);
    customerIds.push(r.customer_id);
    dates.push(r.order_date);
    amounts.push(r.order_amount);
    statuses.push(r.status);
  }

  const client = await pools[shardIndex].connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(INSERT_SQL, [orderIds, customerIds, dates, amounts, statuses]);
    await client.query('COMMIT');
    return result.rowCount;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // never forget this
  }
}