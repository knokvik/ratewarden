#!/usr/bin/env node

/**
 * Quick demo script to showcase rate-guard
 * Run with: node demo.js
 */

const http = require('http');

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(token, count) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/public',
            method: 'GET',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const remaining = res.headers['ratelimit-remaining'];
                const limit = res.headers['ratelimit-limit'];

                if (res.statusCode === 200) {
                    log('green', `✓ Request ${count}: Success (${remaining}/${limit} remaining)`);
                } else if (res.statusCode === 429) {
                    const retryAfter = res.headers['retry-after'];
                    log('red', `✗ Request ${count}: Rate Limited! Retry after ${retryAfter}s`);
                }
                resolve(res.statusCode);
            });
        });

        req.on('error', () => {
            log('red', '✗ Error: Is the server running? Start it with: node examples/basic.js');
            process.exit(1);
        });

        req.end();
    });
}

async function runDemo() {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   rate-guard Demo - Identity-Aware        ║');
    console.log('║   Rate Limiting in Action                 ║');
    console.log('╚════════════════════════════════════════════╝\n');

    log('cyan', '📝 Testing Anonymous User (Guest Tier: 30 req/min)...\n');

    for (let i = 1; i <= 35; i++) {
        await makeRequest(null, i);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    log('yellow', '\n⏳ Waiting 2 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    log('cyan', '📝 Testing Authenticated User (Free Tier: 60 req/min)...\n');

    for (let i = 1; i <= 10; i++) {
        await makeRequest('authenticated-user-token-123', i);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    log('blue', '\n✨ Notice how authenticated users have a different limit!\n');
    log('yellow', '🎯 This is identity-aware rate limiting in action.\n');

    console.log('Different identities get different limits:');
    console.log('  • Anonymous (IP): 30 requests/min');
    console.log('  • Authenticated: 60 requests/min');
    console.log('  • Pro users: 600 requests/min (in advanced example)');
    console.log('  • Admin: Unlimited\n');
}

// Check if server is running
http.get('http://localhost:3000/api/public', (res) => {
    runDemo();
}).on('error', () => {
    log('red', '\n✗ Server not running!');
    log('yellow', '\nPlease start the server first:');
    log('cyan', '   node examples/basic.js\n');
    log('yellow', 'Then run this demo in another terminal:');
    log('cyan', '   node demo.js\n');
    process.exit(1);
});
