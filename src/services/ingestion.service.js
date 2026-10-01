import { parse } from 'csv-parse';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { validateRow } from '../utils/validator.js';
import { getShardIndex } from '../db/shardRouter.js';
import { insertBatch } from '../db/ordersRepository.js';

const MAX_ERRORS_KEPT = 20; // cap memory used by error samples

// Takes ANY readable stream of CSV bytes. Returns a summary.
export async function ingestCsvStream(readable) {
  const shardCount = config.shardUrls.length;
  const buffers = Array.from({ length: shardCount }, () => []);

  const summary = {
    parsed: 0,
    invalid: 0,
    inserted: 0,
    duplicatesSkipped: 0,
    failedBatches: 0,
    perShard: Array.from({ length: shardCount }, () => ({ inserted: 0 })),
    errors: [],
  };

  const addError = (line, reason) => {
    summary.invalid++;
    logger.warn({ line, reason }, 'invalid row skipped');
    if (summary.errors.length < MAX_ERRORS_KEPT) summary.errors.push({ line, reason });
  };

  async function flush(shardIndex) {
    const rows = buffers[shardIndex];
    if (rows.length === 0) return;
    buffers[shardIndex] = [];
    try {
      const inserted = await insertBatch(shardIndex, rows);
      summary.inserted += inserted;
      summary.duplicatesSkipped += rows.length - inserted;
      summary.perShard[shardIndex].inserted += inserted;
      logger.info({ shard: shardIndex, sent: rows.length, inserted }, 'batch inserted');
    } catch (err) {
      summary.failedBatches++;
      logger.error({ shard: shardIndex, rows: rows.length, err: err.message }, 'batch failed');
    }
  }

  const parser = readable.pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: false,
      skip_records_with_error: true,
      on_skip: (err) => addError(err.lines, err.message),
    })
  );

  // for await = automatic backpressure: no new row is read while we await the DB
  for await (const raw of parser) {
    summary.parsed++;
    const { value, error } = validateRow(raw);
    if (error) {
      addError(summary.parsed + 1, error);
      continue;
    }
    const idx = getShardIndex(value.customer_id);
    buffers[idx].push(value);
    if (buffers[idx].length >= config.batchSize) {
      await flush(idx);
    }
  }

  // FINAL FLUSH: insert the partially filled buffers
  for (let i = 0; i < shardCount; i++) await flush(i);

  return summary;
}