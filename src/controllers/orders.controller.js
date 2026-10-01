import Busboy from 'busboy';
import crypto from 'crypto';
import { uploadStreamToGcs, readStreamFromGcs } from '../services/storage.service.js';
import { ingestCsvStream } from '../services/ingestion.service.js';
import { logger } from '../utils/logger.js';

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export function uploadOrders(req, res) {
  if (!req.is('multipart/form-data')) {
    return res.status(400).json({ error: 'Send multipart/form-data with a "file" field' });
  }

  let busboy;
  try {
    busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_FILE_BYTES } });
  } catch (e) {
    return res.status(400).json({ error: 'Invalid multipart request' });
  }

  let handled = false;
  let uploadPromise = null;
  let tooLarge = false;
  const objectName = `uploads/${Date.now()}-${crypto.randomUUID()}.csv`;

  busboy.on('file', (field, fileStream, info) => {
    handled = true;
    if (!info.filename.toLowerCase().endsWith('.csv')) {
      fileStream.resume();
      uploadPromise = Promise.reject(Object.assign(new Error('Only .csv files are accepted'), { status: 400 }));
      uploadPromise.catch(() => {});
      return;
    }
    fileStream.on('limit', () => { tooLarge = true; });
    uploadPromise = uploadStreamToGcs(fileStream, objectName);
    uploadPromise.catch(() => {});
  });

  busboy.on('close', async () => {
    if (!handled) return res.status(400).json({ error: 'No file received' });

    try {
      logger.info('upload request received');
      const gcsUri = await uploadPromise;
      if (tooLarge) {
        return res.status(413).json({ error: 'File too large (max 50 MB)' });
      }

      logger.info({ gcsUri }, 'processing started');
      const summary = await ingestCsvStream(readStreamFromGcs(objectName));
      logger.info({ gcsUri, ...summary, errors: undefined }, 'processing finished');

      const status = summary.failedBatches > 0 ? 207 : 200;
      return res.status(status).json({
        status: summary.failedBatches > 0 ? 'partially_processed' : 'completed',
        file: gcsUri,
        ...summary,
      });
    } catch (err) {
      logger.error({ err: err.message }, 'upload-orders failed');
      if (err.status === 400) return res.status(400).json({ error: err.message });
      return res.status(502).json({ error: 'Upload or processing failed. Check server logs.' });
    }
  });

  busboy.on('error', (err) => {
    logger.error({ err: err.message }, 'multipart parse error');
    if (!res.headersSent) res.status(400).json({ error: 'Malformed upload' });
  });

  req.pipe(busboy);
}