const express = require('express');
const ratewarden = require('../../src/index'); // In your app: require('ratewarden')

const app = express();
const PORT = 3000;

// ============================================
// ZERO-CONFIG EXAMPLE
// ============================================
// Just add one line and you're protected!
app.use(ratewarden());

// ============================================
// EXAMPLE ROUTES
// ============================================

// Public route - no auth
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the ratewarden demo!',
    tip: 'Add an Authorization header to get higher limits',
    endpoints: {
      '/': 'This message',
      '/api/data': 'Get some data (rate limited)',
      '/api/status': 'Check your rate limit status'
    }
  });
});

// Protected API endpoint
app.get('/api/data', (req, res) => {
  res.json({
    message: 'Success! You are within your rate limit.',
    data: {
      timestamp: new Date().toISOString(),
      randomValue: Math.random()
    },
    headers: {
      limit: res.getHeader('RateLimit-Limit'),
      remaining: res.getHeader('RateLimit-Remaining'),
      reset: res.getHeader('RateLimit-Reset')
    }
  });
});

// Status endpoint - shows current rate limit info
app.get('/api/status', (req, res) => {
  res.json({
    yourRateLimits: {
      limit: res.getHeader('RateLimit-Limit'),
      remaining: res.getHeader('RateLimit-Remaining'),
      resetAt: new Date(parseInt(res.getHeader('RateLimit-Reset')) * 1000).toISOString()
    },
    identity: {
      hasAuthToken: !!req.headers.authorization,
      hasUserId: !!req.headers['x-user-id'],
      ip: req.ip
    }
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`\n🚀 ratewarden demo server running on http://localhost:${PORT}\n`);
  console.log('Try these commands:\n');
  console.log('  # Anonymous (guest tier: 30 req/min)');
  console.log(`  curl http://localhost:${PORT}/api/data\n`);
  console.log('  # Authenticated (free tier: 60 req/min)');
  console.log(`  curl -H "Authorization: Bearer demo-token" http://localhost:${PORT}/api/data\n`);
  console.log('  # Check status');
  console.log(`  curl http://localhost:${PORT}/api/status\n`);
  console.log('  # Trigger rate limit (run this 35+ times quickly)');
  console.log(`  for i in {1..35}; do curl http://localhost:${PORT}/api/data; done\n`);
});
