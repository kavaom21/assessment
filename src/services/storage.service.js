import { Storage } from '@google-cloud/storage';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { PassThrough, Readable } from 'stream';

// ADC: no credentials passed anywhere. The library finds them by itself.
// If STORAGE_EMULATOR_HOST is set in .env, the library talks to the local emulator instead.
const storage = new Storage(
  config.gcpProjectId ? { projectId: config.gcpProjectId } : {}
);
const bucket = storage.bucket(config.bucketName);

// Streams the upload straight to GCS. Resolves when GCS has the whole file.
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

// Streams the file back from GCS (a Readable).
export function readStreamFromGcs(objectName) {
  const emulator = process.env.STORAGE_EMULATOR_HOST;

  // Emulator only: read through the emulator's JSON API URL directly
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

  // Real GCS with ADC
  return bucket.file(objectName).createReadStream({ validation: false });
}