/**
 * HTTP RateLimit headers
 * Implements draft-ietf-httpapi-ratelimit-headers standard
 */

/**
 * Set standard RateLimit headers on response
 * @param {object} res - Express response object
 * @param {number} limit - Maximum requests allowed
 * @param {number} remaining - Remaining requests in current window
 * @param {number} resetTime - Unix timestamp when limit resets
 */
function setRateLimitHeaders(res, limit, remaining, resetTime) {
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetTime));
}

/**
 * Set Retry-After header for 429 responses
 * @param {object} res - Express response object
 * @param {number} retryAfter - Seconds until retry is allowed
 */
function setRetryAfterHeader(res, retryAfter) {
    res.setHeader('Retry-After', String(retryAfter));
}

/**
 * Send 429 Too Many Requests response
 * @param {object} res - Express response object
 * @param {object} options - Response options
 */
function send429Response(res, options) {
    const {
        tier,
        limit,
        retryAfter,
        current
    } = options;

    setRetryAfterHeader(res, retryAfter);

    res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded for tier '${tier}'`,
        tier,
        limit,
        current,
        retryAfter
    });
}

module.exports = {
    setRateLimitHeaders,
    setRetryAfterHeader,
    send429Response
};
