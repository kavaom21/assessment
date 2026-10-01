import fs from 'fs';
import { ingestCsvStream } from './services/ingestion.service.js';
import { closePools } from './db/shardPools.js';

const summary = await ingestCsvStream(fs.createReadStream('samples/orders.csv'));
console.log(JSON.stringify(summary, null, 2));
await closePools();