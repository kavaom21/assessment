import { getShardIndex } from './db/shardRouter.js';
import { insertBatch } from './db/ordersRepository.js';
import { closePools } from './db/shardPools.js';

const rows = [
  { order_id: 'T-1', customer_id: 'C101', order_date: '2026-03-01T10:00:00Z', order_amount: '250.50', status: 'PAID' },
  { order_id: 'T-2', customer_id: 'C205', order_date: '2026-03-02T10:00:00Z', order_amount: '99.00', status: 'SHIPPED' },
  { order_id: 'T-3', customer_id: 'C101', order_date: '2026-03-03T10:00:00Z', order_amount: '10.00', status: 'PAID' },
];

const buckets = {};
for (const r of rows) {
  const i = getShardIndex(r.customer_id);
  (buckets[i] ||= []).push(r);
}

for (const [i, list] of Object.entries(buckets)) {
  const inserted = await insertBatch(Number(i), list);
  console.log(`shard ${i}: sent ${list.length}, inserted ${inserted}`);
}
await closePools();