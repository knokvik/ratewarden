/**
 * Example: Using ratewarden with Redis for distributed rate limiting
 * 
 * Scenario: You have multiple app servers behind a load balancer.
 * Without Redis, each server tracks limits independently (inconsistent).
 * With Redis, all servers share the same rate limit state (consistent).
 * 
 * Prerequisites:
 * 1. Install redis: npm install redis
 * 2. Running Redis server (local or hosted)
 */

const express = require('express');
const { createClient } = require('redis');
const ratewarden = require('../src/index');

async function main() {
    const app = express();

    // Step 1: Create and connect Redis client
    console.log('Connecting to Redis...');
    const redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('Redis connected'));

    await redisClient.connect();

    // Step 2: Apply ratewarden with Redis store
    app.use(ratewarden({
        windowMs: 60000, // 1 minute
        tiers: {
            guest: 10,
            free: 100,
            pro: 1000,
            admin: Infinity
        },
        redisClient,
        redisPrefix: 'myapp:ratelimit:', // Custom prefix
        onLimitReached: (req, res, info) => {
            console.log(`[RATE LIMIT] ${info.tier} tier hit limit: ${info.current}/${info.limit}`);
        }
    }));

    // Step 3: Define routes
    app.get('/api/data', (req, res) => {
        res.json({
            message: 'Data retrieved successfully',
            tier: req.headers['x-tier'] || 'guest',
            timestamp: new Date().toISOString()
        });
    });

    app.get('/api/slow', (req, res) => {
        // Simulate slow endpoint
        setTimeout(() => {
            res.json({ message: 'Slow operation completed' });
        }, 1000);
    });

    // Health check (bypasses rate limiting if placed before middleware)
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', redis: redisClient.isReady });
    });

    // Step 4: Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on http://localhost:${PORT}`);
        console.log('📌 Using Redis for distributed rate limiting\n');
        console.log('Test with:');
        console.log(`  curl http://localhost:${PORT}/api/data`);
        console.log(`  curl -H "Authorization: Bearer test-token" http://localhost:${PORT}/api/data`);
        console.log(`  curl -H "x-user-id: user123" http://localhost:${PORT}/api/data\n`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('SIGTERM received, closing connections...');
        await redisClient.quit();
        process.exit(0);
    });
}

main().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
