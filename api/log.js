import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';

const MAX_BODY_SIZE = 4_500_000;
const DEFAULT_BLOB_PREFIX = 'logs';
const RESEND_EMAIL_API_URL = 'https://api.resend.com/emails';
const DEFAULT_ALERT_TO_EMAIL = 'paulo@teuapp.dev.br';

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

function slugify(value, fallback) {
  const input = String(value ?? '').trim();
  if (!input) return fallback;

  const slug = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return slug || fallback;
}

function buildBlobPath(entry, kind) {
  const prefix = (process.env.LOGGER_BLOB_PREFIX || DEFAULT_BLOB_PREFIX).replace(/\/$/, '');
  const datePart = entry.receivedAt.slice(0, 10);
  const projectName = slugify(entry?.payload?.app, 'sem-projeto');
  const contextName = slugify(entry?.payload?.context, kind);
  const shortId = randomUUID().split('-')[0];
  return `${prefix}/${projectName}/${datePart}/${contextName}/${shortId}.json`;
}

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || '';
}

function getEmailConfig() {
  return {
    enabled: process.env.LOGGER_ALERT_EMAIL_ENABLED !== 'false',
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.LOGGER_ALERT_FROM_EMAIL || '',
    to: process.env.LOGGER_ALERT_TO_EMAIL || DEFAULT_ALERT_TO_EMAIL,
  };
}

async function persistLogEntry(entry, kind) {
  const token = getBlobToken();
  if (!token) {
    throw new Error('Missing BLOB_READ_WRITE_TOKEN');
  }

  const pathname = buildBlobPath(entry, kind);
  const { url } = await put(pathname, `${JSON.stringify(entry)}\n`, {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
    token,
  });

  return { pathname, url };
}

function formatValue(value, fallback = '-') {
  if (value == null) return fallback;
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }

  return String(value);
}

function buildEmailSubject(entry) {
  const app = formatValue(entry?.payload?.app, 'sem-projeto');
  const context = formatValue(entry?.payload?.context, 'sem-contexto');
  return `[${app}] Excecao em ${context}`;
}

function buildEmailBody(entry, blobInfo) {
  const payload = entry?.payload || {};
  const lines = [
    'Uma nova excecao foi registrada pelo logger_service.',
    '',
    `Projeto: ${formatValue(payload.app)}`,
    `Contexto: ${formatValue(payload.context)}`,
    `Recebido em: ${formatValue(entry.receivedAt)}`,
    `Plataforma: ${formatValue(payload.platform)}`,
    `Versao da plataforma: ${formatValue(payload.platformVersion)}`,
    `IP: ${formatValue(entry.ip)}`,
    `User-Agent: ${formatValue(entry.userAgent)}`,
    `Blob path: ${formatValue(blobInfo?.pathname)}`,
    `Blob url: ${formatValue(blobInfo?.url)}`,
    '',
    'Erro:',
    formatValue(payload.error),
    '',
    'Stack trace:',
    formatValue(payload.stackTrace),
  ];

  if (payload.extra != null) {
    lines.push('', 'Extra:', formatValue(payload.extra));
  }

  return lines.join('\n');
}

async function sendErrorEmail(entry, blobInfo) {
  const email = getEmailConfig();
  if (!email.enabled) {
    return { sent: false, skipped: 'disabled' };
  }

  if (!email.apiKey) {
    console.warn('[logger] email skipped: missing RESEND_API_KEY');
    return { sent: false, skipped: 'missing-api-key' };
  }

  if (!email.from) {
    console.warn('[logger] email skipped: missing LOGGER_ALERT_FROM_EMAIL');
    return { sent: false, skipped: 'missing-from-email' };
  }

  const response = await fetch(RESEND_EMAIL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${email.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: email.from,
      to: [email.to],
      subject: buildEmailSubject(entry),
      text: buildEmailBody(entry, blobInfo),
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Failed to send email (${response.status}): ${responseText}`,
    );
  }

  return { sent: true };
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
      const emailInfo = await sendErrorEmail(invalidEntry, blobInfo);
      console.error('[logger] email result', emailInfo);
    } catch (blobError) {
      console.error('[logger] invalid payload handling failed', blobError);
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
    try {
      const emailInfo = await sendErrorEmail(entry, blobInfo);
      console.log('[logger] email result', emailInfo);
    } catch (emailError) {
      console.error('[logger] email send failed', emailError);
    }
  } catch (error) {
    console.error('[logger] blob write failed', error);
    return res.status(500).json({ ok: false, error: 'Failed to persist log' });
  }

  return res.status(200).json({ ok: true });
}
