/**
 * ratewarden - Identity-aware, tier-based rate limiting middleware
 * 
 * Zero-config rate limiting for Node.js APIs.
 * Automatically detects user identity (token → user ID → IP) and applies
 * tier-based limits (guest/free/pro/admin) using a sliding window algorithm.
 * 
 * Supports both in-memory (single server) and Redis (distributed) storage.
 * 
 * @module ratewarden
 * @see https://github.com/knokvik/ratewarden
 */

const { resolveIdentity } = require('./identity');
const { resolveTier, getTierLimit, DEFAULT_TIERS, DEFAULT_WINDOW_MS } = require('./tier');
const { setRateLimitHeaders, send429Response } = require('./headers');
const CleanupManager = require('./cleanup');
const createMemoryStore = require('./stores/memory');
const createRedisStore = require('./stores/redis');

/**
 * Create a rate limiting middleware for Express.js
 * 
 * This is the main factory function that creates and configures the rate limiter.
 * Call it with options (or no arguments for zero-config mode) and use the result
 * as Express middleware.
 * 
 * @param {Object} [options={}] - Configuration options
 * @param {number} [options.windowMs=60000] - Time window in milliseconds (default: 60000 = 1 minute)
 * @param {Object} [options.tiers] - Tier configuration mapping tier names to request limits
 *                                    (default: { guest: 30, free: 60, pro: 600, admin: Infinity })
 * @param {Function} [options.resolveTier] - Custom tier resolver function (req => tierName)
 *                                            Receives the request and returns a tier name
 * @param {Function} [options.keyGenerator] - Custom identity key generator (req => uniqueKey)
 *                                             Receives the request and returns a unique identity key
 * @param {Function} [options.onLimitReached] - Callback when rate limit is exceeded
 *                                               Signature: (req, res, info) => void
 *                                               Called BEFORE sending the 429 response
 * @param {Object} [options.redisClient] - Redis client instance (from 'redis' package v4+)
 *                                          If provided, uses Redis for distributed rate limiting
 *                                          If omitted, uses in-memory storage (single server only)
 * @param {string} [options.redisPrefix='ratewarden:'] - Prefix for Redis keys (only used if redisClient provided)
 * 
 * @returns {Function} Express middleware function with signature (req, res, next)
 * 
 * @example
 * // Zero config - in-memory (recommended for most use cases)
 * app.use(ratewarden());
 * 
 * @example
 * // Custom tiers - in-memory
 * app.use(ratewarden({
 *   tiers: { guest: 10, free: 100, pro: 1000 }
 * }));
 * 
 * @example
 * // Redis for distributed systems
 * const { createClient } = require('redis');
 * const redisClient = await createClient().connect();
 * app.use(ratewarden({
 *   redisClient,
 *   redisPrefix: 'myapp:ratelimit:'
 * }));
 * 
 * @example
 * // Custom tier resolution
 * app.use(ratewarden({
 *   resolveTier: (req) => req.user?.plan || 'guest'
 * }));
 */
function rateGuard(options = {}) {
    // Configuration with sensible defaults
    const config = {
        windowMs: options.windowMs || DEFAULT_WINDOW_MS,
        tiers: options.tiers || DEFAULT_TIERS,
        resolveTier: options.resolveTier,
        keyGenerator: options.keyGenerator,
        onLimitReached: options.onLimitReached,
        redisClient: options.redisClient,
        redisPrefix: options.redisPrefix || 'ratewarden:'
    };

    // Create appropriate store
    let store;
    let cleanup = null;

    if (config.redisClient) {
        // Use Redis store for distributed rate limiting
        try {
            store = createRedisStore(config.redisClient, {
                windowMs: config.windowMs,
                prefix: config.redisPrefix
            });
            // Redis handles cleanup via TTL, no need for CleanupManager
        } catch (error) {
            throw new Error(`[ratewarden] Failed to initialize Redis store: ${error.message}`);
        }
    } else {
        // Use in-memory store (default)
        store = createMemoryStore({
            windowMs: config.windowMs
        });

        // Start automatic cleanup for memory store (prevents memory leaks)
        cleanup = new CleanupManager(store, config.windowMs);
        cleanup.start();
    }

    // Return the actual middleware function
    return function rateGuardMiddleware(req, res, next) {
        // Use async IIFE to handle promises properly
        (async () => {
            try {
                // Step 1: Resolve identity (who is making this request?)
                let identityKey, source;

                if (config.keyGenerator) {
                    // Use custom key generator if provided
                    identityKey = config.keyGenerator(req);
                    source = 'custom';
                } else {
                    // Use default identity resolution (token → user ID → IP)
                    const identity = resolveIdentity(req);
                    identityKey = identity.key;
                    source = identity.source;
                }

                // Step 2: Resolve tier (what limits should apply?)
                const tier = resolveTier(req, source, config.resolveTier);

                // Step 3: Get limit for tier
                const limit = getTierLimit(tier, config.tiers);

                // Step 4: Check rate limit (sliding window algorithm)
                // For Redis store, pass tier for key namespacing
                const result = config.redisClient
                    ? await store.checkLimit(identityKey, limit, tier)
                    : await store.checkLimit(identityKey, limit);

                // Step 5: Set standard HTTP RateLimit headers
                setRateLimitHeaders(res, limit, result.remaining, result.resetTime);

                // Step 6: Handle result
                if (!result.allowed) {
                    // Call custom handler if provided (for logging, monitoring, etc.)
                    if (config.onLimitReached) {
                        config.onLimitReached(req, res, {
                            tier,
                            limit,
                            current: result.current,
                            retryAfter: result.retryAfter
                        });
                    }

                    // Send 429 Too Many Requests response
                    return send429Response(res, {
                        tier,
                        limit,
                        current: result.current,
                        retryAfter: result.retryAfter
                    });
                }

                // Request allowed - continue to next middleware
                next();

            } catch (error) {
                // On error, allow request but log it (fail-open for reliability)
                console.error('[ratewarden] Error:', error.message);
                next();
            }
        })();
    };
}

/**
 * Export both factory function and named export
 */
module.exports = rateGuard;
module.exports.rateGuard = rateGuard;
module.exports.DEFAULT_TIERS = DEFAULT_TIERS;
module.exports.DEFAULT_WINDOW_MS = DEFAULT_WINDOW_MS;
module.exports.createMemoryStore = createMemoryStore;
module.exports.createRedisStore = createRedisStore;
