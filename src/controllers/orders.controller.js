import Busboy from 'busboy';
import crypto from 'crypto';
import { uploadStreamToGcs, readStreamFromGcs } from '../services/storage.service.js';
import { ingestCsvStream } from '../services/ingestion.service.js';
import { logger } from '../utils/logger.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function uploadOrders(req, res) {
  if (!req.is('multipart/form-data')) {
    return res.status(400).json({ error: 'Please send the CSV as multipart/form-data' });
  }

  let busboy;

  try {
    busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_FILE_SIZE } });
  } catch (err) {
    return res.status(400).json({ error: 'Invalid upload request' });
  }

  let fileFound = false;
  let wrongFileType = false;
  let tooLarge = false;
  let uploadPromise;

  const fileName = `uploads/${Date.now()}-${crypto.randomUUID()}.csv`;

  busboy.on('file', (fieldName, fileStream, info) => {
    fileFound = true;

    if (!info.filename.toLowerCase().endsWith('.csv')) {
      wrongFileType = true;
      fileStream.resume(); 
      return;
    }

    fileStream.on('limit', () => {
      tooLarge = true;
    });

    uploadPromise = uploadStreamToGcs(fileStream, fileName);
    uploadPromise.catch(() => {}); 
  });

  busboy.on('close', async () => {
    if (!fileFound) {
      return res.status(400).json({ error: 'No file received' });
    }
    if (wrongFileType) {
      return res.status(400).json({ error: 'Only .csv files are allowed' });
    }

    try {
      const gcsPath = await uploadPromise; 
      if (tooLarge) {
        return res.status(413).json({ error: 'File too large (max 50 MB)' });
      }

      const summary = await ingestCsvStream(readStreamFromGcs(fileName));
      logger.info({ gcsPath, inserted: summary.inserted }, 'file processed');

      const hasFailures = summary.failedBatches > 0;
      return res.status(hasFailures ? 207 : 200).json({
        status: hasFailures ? 'partially_processed' : 'completed',
        file: gcsPath,
        ...summary,
      });
    } catch (err) {
      logger.error({ err: err.message }, 'upload failed');
      return res.status(502).json({ error: 'Upload or processing failed' });
    }
  });

  busboy.on('error', (err) => {
    logger.error({ err: err.message }, 'multipart parse error');
    if (!res.headersSent) {
      res.status(400).json({ error: 'Malformed upload' });
    }
  });

  req.pipe(busboy);
}