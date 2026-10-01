import express from 'express';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import ordersRoutes from './routes/orders.routes.js';
import { pools, closePools } from './db/shardPools.js';

const app = express();

app.get('/health', async (req, res) => {
  try {
    await Promise.all(pools.map((p) => p.query('SELECT 1')));
    res.json({ status: 'ok', shards: pools.length });
  } catch (e) {
    res.status(503).json({ status: 'degraded' });
  }
});

app.use(ordersRoutes);

const server = app.listen(config.port, () =>
  logger.info({ port: config.port, storage: config.storageDriver }, 'server started')
);

process.on('SIGINT', async () => {
  server.close();
  await closePools();
  process.exit(0);
});