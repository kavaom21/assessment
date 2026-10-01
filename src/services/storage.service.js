import { Storage } from '@google-cloud/storage';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { PassThrough, Readable } from 'stream';


const storage = new Storage(
  config.gcpProjectId ? { projectId: config.gcpProjectId } : {}
);
const bucket = storage.bucket(config.bucketName);

export function uploadStreamToGcs(readable, objectName) {
  return new Promise((resolve, reject) => {
    const file = bucket.file(objectName);
    const writeStream = file.createWriteStream({
      resumable: false,
      contentType: 'text/csv',
    });
    logger.info({ objectName }, 'GCS upload started');
    readable.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', () => {
      logger.info({ objectName }, 'GCS upload finished');
      resolve(`gs://${config.bucketName}/${objectName}`);
    });
    readable.pipe(writeStream);
  });
}

export function readStreamFromGcs(objectName) {
  
  const emulator = process.env.STORAGE_EMULATOR_HOST;

  if (emulator) {
    const url = `${emulator.replace(/\/$/, '')}/storage/v1/b/${config.bucketName}/o/${encodeURIComponent(objectName)}?alt=media`;
    const out = new PassThrough();
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`emulator read failed: ${res.status}`);
        Readable.fromWeb(res.body).on('error', (e) => out.destroy(e)).pipe(out);
      })
      .catch((e) => out.destroy(e));
    return out;
  }

  return bucket.file(objectName).createReadStream({ validation: false });
}