import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3000),
  batchSize: Number(process.env.BATCH_SIZE || 500),
  shardUrls: (process.env.SHARD_URLS || '').split(',').map((s) => s.trim()).filter(Boolean),
  storageDriver: process.env.STORAGE_DRIVER || 'gcs',
  gcpProjectId: process.env.GCP_PROJECT_ID,
  bucketName: process.env.GCS_BUCKET_NAME,
};

if (config.shardUrls.length === 0) {
  throw new Error('SHARD_URLS is empty. Check your .env file.');
}