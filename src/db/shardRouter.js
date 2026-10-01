import crypto from 'crypto';
import { config } from '../config/index.js';

// Stable hash: same customer_id always gives the same number, on every run and machine.
export function getShardIndex(customerId) {
  const hash = crypto.createHash('md5').update(String(customerId)).digest();
  const num = hash.readUInt32BE(0); // first 4 bytes as an unsigned integer
  return num % config.shardUrls.length;
}