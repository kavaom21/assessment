import crypto from 'crypto';
import { config } from '../config/index.js';

export function getShardIndex(customerId) {
  const hash = crypto.createHash('md5').update(String(customerId)).digest();
  const num = hash.readUInt32BE(0);
  return num % config.shardUrls.length;
}