import fs from 'node:fs';
import path from 'node:path';

const defaultRepoLogPath = path.join(process.cwd(), 'logs', 'requests.log');
const fallbackTmpLogPath = '/tmp/requests.log';

function appendLogLine(line) {
  try {
    fs.appendFileSync(defaultRepoLogPath, line, 'utf8');
    return;
  } catch (_) {
    // Em runtime serverless o filesystem do projeto é read-only.
  }

  try {
    fs.appendFileSync(fallbackTmpLogPath, line, 'utf8');
  } catch (_) {
    // Falha silenciosa: não derruba a função por logging em arquivo.
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 4_500_000) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
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
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  let payload;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw || '{}');
  } catch (error) {
    appendLogLine(`${new Date().toISOString()} | invalid-json | ${String(error)}\n`);
    return res.status(400).json({ ok: false, error: 'Invalid JSON payload' });
  }

  const entry = {
    receivedAt: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
    payload,
  };

  appendLogLine(`${JSON.stringify(entry)}\n`);

  return res.status(200).json({ ok: true });
}
