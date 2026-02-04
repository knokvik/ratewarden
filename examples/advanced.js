/**
 * Example: Advanced tier-based rate limiting
 * Run with: node examples/advanced.js
 */

const express = require('express');
const ratewarden = require('../src/index');

const app = express();
app.use(express.json());

// Simulate authentication middleware
app.use((req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.replace('Bearer ', '');

        // Simulate different user types based on token
        if (token.includes('admin')) {
            req.user = { id: 1, plan: 'admin', isAdmin: true };
        } else if (token.includes('pro')) {
            req.user = { id: 2, plan: 'pro' };
        } else {
            req.user = { id: 3, plan: 'free' };
        }
    }

    next();
});

// Advanced rate limiting with custom tier resolution
app.use(ratewarden({
    windowMs: 60000, // 1 minute
    tiers: {
        free: 10,        // 10 requests per minute
        pro: 100,        // 100 requests per minute
        admin: Infinity  // Unlimited
    },
    resolveTier: (req) => {
        if (req.user?.isAdmin) return 'admin';
        if (req.user?.plan) return req.user.plan;
        return 'guest'; // Default for anonymous users
    },
    onLimitReached: (req, res, info) => {
        console.log(`⚠️  Rate limit exceeded: tier=${info.tier}, count=${info.current}/${info.limit}`);
    }
}));

// API endpoints
app.get('/api/users', (req, res) => {
    res.json({
        users: ['Alice', 'Bob', 'Charlie'],
        tier: req.user?.plan || 'guest'
    });
});

app.post('/api/data', (req, res) => {
    res.json({
        success: true,
        message: 'Data received',
        yourTier: req.user?.plan || 'guest'
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`\n🚀 Advanced ratewarden example running on http://localhost:${PORT}\n`);
    console.log('Test different user tiers:\n');
    console.log('1. Free tier (10 req/min):');
    console.log(`   curl -H "Authorization: Bearer free-user-token" http://localhost:${PORT}/api/users\n`);
    console.log('2. Pro tier (100 req/min):');
    console.log(`   curl -H "Authorization: Bearer pro-user-token" http://localhost:${PORT}/api/users\n`);
    console.log('3. Admin tier (unlimited):');
    console.log(`   curl -H "Authorization: Bearer admin-token" http://localhost:${PORT}/api/users\n`);
    console.log('4. Test rate limit for free tier:');
    console.log(`   for i in {1..15}; do curl -H "Authorization: Bearer free-user-token" http://localhost:${PORT}/api/users; echo ""; done\n`);
    console.log('Notice how different tiers get different limits!\n');
});
