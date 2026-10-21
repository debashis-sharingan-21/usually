import test from 'node:test';
import assert from 'node:assert/strict';

// Helper matching fetchNotifications error extraction logic
async function extractNotificationErrorMessage(response: {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get: (name: string) => string | null };
  json: () => Promise<any>;
}): Promise<string> {
  if (response.ok) return '';

  let detail = '';
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      if (body && typeof body.detail === 'string') {
        detail = body.detail
          .split('\n')[0]
          .replace(/([A-Z]:\\[^\s]+|\/[^\s]+)/gi, '')
          .trim()
          .slice(0, 100);
      }
    }
  } catch {
    // Non-JSON fallback
  }

  return detail
    ? `HTTP ${response.status}: ${detail}`
    : `HTTP ${response.status} ${response.statusText || 'Error'}`.trim();
}

test('distinguishes HTTP 500 error and formats safe detail', async () => {
  const mockRes = {
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    headers: { get: (name: string) => (name === 'content-type' ? 'application/json' : null) },
    json: async () => ({ detail: 'Unable to compute notifications from transaction history\nTraceback at /var/app/routes.py' })
  };

  const msg = await extractNotificationErrorMessage(mockRes);
  assert.equal(msg, 'HTTP 500: Unable to compute notifications from transaction history');
  // Ensures local paths / stack traces are stripped
  assert.equal(msg.includes('/var/app'), false);
});

test('distinguishes HTTP 401 session expiration', async () => {
  const mockRes = {
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    headers: { get: (name: string) => (name === 'content-type' ? 'application/json' : null) },
    json: async () => ({ detail: 'Invalid or expired session token' })
  };

  const msg = await extractNotificationErrorMessage(mockRes);
  assert.equal(msg, 'HTTP 401: Invalid or expired session token');
});

test('handles non-JSON HTTP 502/504 Bad Gateway from cloud proxies safely', async () => {
  const mockRes = {
    ok: false,
    status: 502,
    statusText: 'Bad Gateway',
    headers: { get: (name: string) => (name === 'content-type' ? 'text/html' : null) },
    json: async () => { throw new Error('Not JSON'); }
  };

  const msg = await extractNotificationErrorMessage(mockRes);
  assert.equal(msg, 'HTTP 502 Bad Gateway');
});
