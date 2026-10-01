import fs from 'fs';

const total = Number(process.argv[2] || 10000);
const out = fs.createWriteStream('samples/orders.csv');
out.write('order_id,customer_id,order_date,order_amount,status\n');

const statuses = ['PAID', 'SHIPPED', 'PENDING', 'CANCELLED'];
for (let i = 1; i <= total; i++) {
  const customer = `C${1 + Math.floor(Math.random() * 2000)}`;
  const date = new Date(Date.now() - Math.random() * 90 * 86400000).toISOString();
  const amount = (Math.random() * 1000).toFixed(2);
  let line = `ORD-${i},${customer},${date},${amount},${statuses[i % 4]}\n`;
  // inject some bad rows
  if (i % 1000 === 0) line = `ORD-${i},${customer},not-a-date,${amount},PAID\n`;
  if (i % 1500 === 0) line = `ORD-${i},${customer},${date},abc,PAID\n`;
  out.write(line);
}
out.end(() => console.log(`wrote ${total} rows`));