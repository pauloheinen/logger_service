export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const enabled = process.env.AUDITOR_ENABLED === 'true';

  return res.status(200).json({
    ok: true,
    service: 'logger_service',
    enabled,
    envVar: 'AUDITOR_ENABLED',
    timestamp: new Date().toISOString(),
  });
}
