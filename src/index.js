/**
 * rate-guard - Identity-aware, tier-based rate limiting middleware
 * Zero-config rate limiting for Node.js APIs
 */

const { resolveIdentity } = require('./identity');
const { resolveTier, getTierLimit, DEFAULT_TIERS, DEFAULT_WINDOW_MS } = require('./tier');
const SlidingWindowLimiter = require('./limiter');
const { setRateLimitHeaders, send429Response } = require('./headers');
const CleanupManager = require('./cleanup');

/**
 * Create rate limiting middleware
 * @param {object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000)
 * @param {object} options.tiers - Tier configuration { tierName: limit }
 * @param {function} options.resolveTier - Custom tier resolver function
 * @param {function} options.keyGenerator - Custom identity key generator
 * @param {function} options.onLimitReached - Callback when limit is reached
 * @returns {function} - Express middleware function
 */
function rateGuard(options = {}) {
    // Configuration
    const config = {
        windowMs: options.windowMs || DEFAULT_WINDOW_MS,
        tiers: options.tiers || DEFAULT_TIERS,
        resolveTier: options.resolveTier,
        keyGenerator: options.keyGenerator,
        onLimitReached: options.onLimitReached
    };

    // Create limiter instance
    const limiter = new SlidingWindowLimiter(config.windowMs);

    // Start automatic cleanup
    const cleanup = new CleanupManager(limiter, config.windowMs);
    cleanup.start();

    // Return middleware function
    return function rateGuardMiddleware(req, res, next) {
        try {
            // Step 1: Resolve identity
            let identityKey, source;

            if (config.keyGenerator) {
                // Use custom key generator if provided
                identityKey = config.keyGenerator(req);
                source = 'custom';
            } else {
                // Use default identity resolution
                const identity = resolveIdentity(req);
                identityKey = identity.key;
                source = identity.source;
            }

            // Step 2: Resolve tier
            const tier = resolveTier(req, source, config.resolveTier);

            // Step 3: Get limit for tier
            const limit = getTierLimit(tier, config.tiers);

            // Step 4: Check rate limit
            const result = limiter.checkLimit(identityKey, limit);

            // Step 5: Set headers
            setRateLimitHeaders(res, limit, result.remaining, result.resetTime);

            // Step 6: Handle result
            if (!result.allowed) {
                // Call custom handler if provided
                if (config.onLimitReached) {
                    config.onLimitReached(req, res, {
                        tier,
                        limit,
                        current: result.current,
                        retryAfter: result.retryAfter
                    });
                }

                // Send 429 response
                return send429Response(res, {
                    tier,
                    limit,
                    current: result.current,
                    retryAfter: result.retryAfter
                });
            }

            // Request allowed - continue
            next();

        } catch (error) {
            // On error, allow request but log it
            console.error('[rate-guard] Error:', error.message);
            next();
        }
    };
}

/**
 * Export both factory function and named export
 */
module.exports = rateGuard;
module.exports.rateGuard = rateGuard;
module.exports.DEFAULT_TIERS = DEFAULT_TIERS;
module.exports.DEFAULT_WINDOW_MS = DEFAULT_WINDOW_MS;
