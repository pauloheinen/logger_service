const STATUS_ENV_ALLOWLIST = new Set([
  'AUDITOR_ENABLED',
]);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const url = new URL(req.url || '/api/status', 'http://localhost');
  const requestedKey = (url.searchParams.get('key') || 'AUDITOR_ENABLED').trim();

  if (!STATUS_ENV_ALLOWLIST.has(requestedKey)) {
    return res.status(400).json({
      ok: false,
      error: 'Status key not allowed',
      requestedKey,
    });
  }

  const enabled = process.env[requestedKey] === 'true';

  return res.status(200).json({
    ok: true,
    service: 'logger_service',
    status: {
      [requestedKey]: enabled,
    },
    timestamp: new Date().toISOString(),
  });
}
