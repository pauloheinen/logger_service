export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  return res.status(200).json({
    ok: true,
    service: 'logger_service',
    endpoints: {
      log: {
        method: 'POST',
        path: '/api/log',
      },
      status: {
        method: 'GET',
        paths: ['/status', '/api/status'],
        query: {
          key: 'AUDITOR_ENABLED',
        },
      },
    },
    timestamp: new Date().toISOString(),
  });
}
