import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';

const MAX_BODY_SIZE = 4_500_000;
const DEFAULT_BLOB_PREFIX = 'logs';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let rejected = false;

    req.on('data', (chunk) => {
      if (rejected) return;

      raw += chunk;
      if (raw.length > MAX_BODY_SIZE) {
        rejected = true;
        reject(new Error('Payload too large'));
      }
    });

    req.on('end', () => {
      if (!rejected) resolve(raw);
    });

    req.on('error', reject);
  });
}

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
}

function buildBlobPath(kind, receivedAt) {
  const prefix = (process.env.LOGGER_BLOB_PREFIX || DEFAULT_BLOB_PREFIX).replace(/\/$/, '');
  const datePart = receivedAt.slice(0, 10);
  const timestampPart = receivedAt.replace(/[:.]/g, '-');
  return `${prefix}/${datePart}/${kind}-${timestampPart}-${randomUUID()}.json`;
}

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || '';
}

async function persistLogEntry(entry, kind) {
  const token = getBlobToken();
  if (!token) {
    throw new Error('Missing BLOB_READ_WRITE_TOKEN');
  }

  const pathname = buildBlobPath(kind, entry.receivedAt);
  const { url } = await put(pathname, `${JSON.stringify(entry)}\n`, {
    contentType: 'application/json; charset=utf-8',
    token,
  });

  return { pathname, url };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const token = process.env.LOGGER_TOKEN;
  if (token) {
    const authHeader = req.headers.authorization || '';
    const expected = `Bearer ${token}`;
    if (authHeader !== expected) {
      console.warn('[logger] unauthorized request');
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  let payload;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw || '{}');
  } catch (error) {
    const invalidEntry = {
      receivedAt: new Date().toISOString(),
      type: 'invalid-json',
      error: String(error),
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
    };

    console.error(JSON.stringify(invalidEntry));

    try {
      const blobInfo = await persistLogEntry(invalidEntry, 'invalid-json');
      console.error('[logger] blob persisted', blobInfo);
    } catch (blobError) {
      console.error('[logger] blob write failed', blobError);
    }

    return res.status(400).json({ ok: false, error: 'Invalid JSON payload' });
  }

  const entry = {
    receivedAt: new Date().toISOString(),
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'] || null,
    payload,
  };

  console.log(JSON.stringify(entry));

  try {
    const blobInfo = await persistLogEntry(entry, 'request');
    console.log('[logger] blob persisted', blobInfo);
  } catch (error) {
    console.error('[logger] blob write failed', error);
    return res.status(500).json({ ok: false, error: 'Failed to persist log' });
  }

  return res.status(200).json({ ok: true });
}
