/**
 * Test suite for rate-guard
 * Simple test runner without external dependencies
 */

const ratewarden = require('../src/index');
const { resolveIdentity } = require('../src/identity');
const SlidingWindowLimiter = require('../src/limiter');

// Test results
let passed = 0;
let failed = 0;

// Helper: Create mock request
function mockRequest(headers = {}) {
    return { headers, ip: '127.0.0.1', connection: {} };
}

// Helper: Create mock response
function mockResponse() {
    const headers = {};
    const res = {
        headers,
        statusCode: 200,
        setHeader(key, value) {
            this.headers[key] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        }
    };
    return res;
}

// Test assertion
function assert(condition, message) {
    if (condition) {
        console.log(`✓ ${message}`);
        passed++;
    } else {
        console.error(`✗ ${message}`);
        failed++;
    }
}

// Test: Identity resolution
console.log('\n=== Testing Identity Resolution ===\n');

const req1 = mockRequest({ authorization: 'Bearer test-token-123' });
const identity1 = resolveIdentity(req1);
assert(identity1.source === 'token', 'Should identify token from Authorization header');

const req2 = mockRequest({ 'x-user-id': 'user-456' });
const identity2 = resolveIdentity(req2);
assert(identity2.source === 'userId', 'Should identify user from x-user-id header');

const req3 = mockRequest({});
const identity3 = resolveIdentity(req3);
assert(identity3.source === 'ip', 'Should fall back to IP address');

// Test: Sliding window limiter
console.log('\n=== Testing Sliding Window Limiter ===\n');

const limiter = new SlidingWindowLimiter(1000); // 1 second window
const testKey = 'test-key';

const check1 = limiter.checkLimit(testKey, 3);
assert(check1.allowed === true, 'First request should be allowed');
assert(check1.remaining === 2, 'Should have 2 remaining requests');

const check2 = limiter.checkLimit(testKey, 3);
assert(check2.allowed === true, 'Second request should be allowed');
assert(check2.remaining === 1, 'Should have 1 remaining request');

const check3 = limiter.checkLimit(testKey, 3);
assert(check3.allowed === true, 'Third request should be allowed');
assert(check3.remaining === 0, 'Should have 0 remaining requests');

const check4 = limiter.checkLimit(testKey, 3);
assert(check4.allowed === false, 'Fourth request should be blocked');
assert(check4.retryAfter > 0, 'Should have retry-after value');

// Test: Window expiration
console.log('\n=== Testing Window Expiration ===\n');

setTimeout(() => {
    const check5 = limiter.checkLimit(testKey, 3);
    assert(check5.allowed === true, 'Request should be allowed after window expires');

    // Test: Cleanup
    console.log('\n=== Testing Cleanup ===\n');

    limiter.cleanup();
    const stats = limiter.getStats();
    assert(stats.totalIdentities >= 0, 'Cleanup should not crash');

    // Test: Middleware
    console.log('\n=== Testing Middleware ===\n');

    const middleware = ratewarden({
        windowMs: 1000,
        tiers: { free: 2, guest: 1 }
    });

    const req = mockRequest({ authorization: 'Bearer test' });
    const res = mockResponse();
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    middleware(req, res, next);

    // Wait for async middleware to complete
    setTimeout(() => {
        assert(nextCalled === true, 'Middleware should call next() on first request');
        assert(res.headers['RateLimit-Limit'] === '2', 'Should set RateLimit-Limit header');
        assert(res.headers['RateLimit-Remaining'] === '1', 'Should set RateLimit-Remaining header');

        // Test: Rate limit exceeded
        console.log('\n=== Testing Rate Limit Exceeded ===\n');

        const req2 = mockRequest({ authorization: 'Bearer test' });
        const res2 = mockResponse();
        let next2Called = false;
        const next2 = () => { next2Called = true; };

        middleware(req2, res2, next2);

        setTimeout(() => {
            assert(next2Called === true, 'Second request should pass');

            const req3 = mockRequest({ authorization: 'Bearer test' });
            const res3 = mockResponse();
            let next3Called = false;
            const next3 = () => { next3Called = true; };

            middleware(req3, res3, next3);

            setTimeout(() => {
                assert(next3Called === false, 'Third request should be blocked');
                assert(res3.statusCode === 429, 'Should return 429 status');
                assert(res3.body.error === 'Too many requests', 'Should return error message');
                assert(res3.headers['Retry-After'] !== undefined, 'Should set Retry-After header');

                // Test: Different identities
                console.log('\n=== Testing Different Identities ===\n');

                const req4 = mockRequest({ authorization: 'Bearer different-token' });
                const res4 = mockResponse();
                let next4Called = false;
                const next4 = () => { next4Called = true; };

                middleware(req4, res4, next4);

                setTimeout(() => {
                    assert(next4Called === true, 'Different identity should have separate limit');

                    // Results
                    console.log('\n=== Test Results ===\n');
                    console.log(`Passed: ${passed}`);
                    console.log(`Failed: ${failed}`);
                    console.log(`Total: ${passed + failed}`);

                    if (failed === 0) {
                        console.log('\n✓ All tests passed!\n');
                        process.exit(0);
                    } else {
                        console.log('\n✗ Some tests failed!\n');
                        process.exit(1);
                    }
                }, 50);
            }, 50);
        }, 50);
    }, 50);
}, 1100); // Wait for window to expire
