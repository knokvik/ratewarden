/**
 * Example: Basic usage of rate-guard
 * Run with: node examples/basic.js
 */

const express = require('express');
const ratewarden = require('../src/index');

const app = express();
app.use(express.json());

// Zero-config rate limiting
app.use(ratewarden());

// Test endpoints
app.get('/api/public', (req, res) => {
    res.json({
        message: 'This endpoint is rate limited',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/data', (req, res) => {
    res.json({
        data: [1, 2, 3, 4, 5],
        note: 'Each user gets their own rate limit!'
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n🎯 ratewarden example server running on http://localhost:${PORT}\n`);
    console.log('Try these commands to test rate limiting:\n');
    console.log('1. Test as anonymous user (IP-based):');
    console.log(`   curl http://localhost:${PORT}/api/public\n`);
    console.log('2. Test as authenticated user (token-based):');
    console.log(`   curl -H "Authorization: Bearer user-token-123" http://localhost:${PORT}/api/public\n`);
    console.log('3. Test rate limit by making multiple requests:');
    console.log(`   for i in {1..35}; do curl http://localhost:${PORT}/api/public; done\n`);
    console.log('4. Check headers:');
    console.log(`   curl -I http://localhost:${PORT}/api/public\n`);
    console.log('Different users get separate limits!');
    console.log('Anonymous users: 30 req/min | Authenticated: 60 req/min\n');
});
