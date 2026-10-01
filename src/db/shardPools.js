import pg from 'pg';
import { config } from '../config/index.js';

export const pools = config.shardUrls.map(
  (connectionString) => new pg.Pool({ connectionString, max: 5 })
);

export async function closePools() {
  await Promise.all(pools.map((p) => p.end()));
}