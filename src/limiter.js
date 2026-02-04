/**
 * Sliding window rate limiter
 * Stores timestamps for each identity and removes expired ones
 */

class SlidingWindowLimiter {
    constructor(windowMs) {
        this.windowMs = windowMs;
        // Map<identityKey, Array<timestamp>>
        this.requests = new Map();
    }

    /**
     * Check if a request should be allowed
     * @param {string} identityKey - Unique identifier for the requester
     * @param {number} limit - Maximum requests allowed in window
     * @returns {object} - { allowed: boolean, current: number, resetTime: number }
     */
    checkLimit(identityKey, limit) {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Get existing timestamps for this identity
        let timestamps = this.requests.get(identityKey) || [];

        // Remove expired timestamps (outside current window)
        timestamps = timestamps.filter(ts => ts > windowStart);

        // Calculate reset time (when oldest request expires)
        const resetTime = timestamps.length > 0
            ? Math.ceil((timestamps[0] + this.windowMs) / 1000)
            : Math.ceil((now + this.windowMs) / 1000);

        // Check if limit exceeded
        if (timestamps.length >= limit) {
            this.requests.set(identityKey, timestamps);
            return {
                allowed: false,
                current: timestamps.length,
                remaining: 0,
                resetTime,
                retryAfter: Math.ceil((timestamps[0] + this.windowMs - now) / 1000)
            };
        }

        // Add current request timestamp
        timestamps.push(now);
        this.requests.set(identityKey, timestamps);

        return {
            allowed: true,
            current: timestamps.length,
            remaining: limit - timestamps.length,
            resetTime,
            retryAfter: 0
        };
    }

    /**
     * Clean up expired entries to prevent memory leaks
     * Should be called periodically
     */
    cleanup() {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        for (const [key, timestamps] of this.requests.entries()) {
            const validTimestamps = timestamps.filter(ts => ts > windowStart);

            if (validTimestamps.length === 0) {
                // Remove completely expired entries
                this.requests.delete(key);
            } else {
                // Update with cleaned timestamps
                this.requests.set(key, validTimestamps);
            }
        }
    }

    /**
     * Get current stats
     * @returns {object} - { totalIdentities: number, totalRequests: number }
     */
    getStats() {
        let totalRequests = 0;
        for (const timestamps of this.requests.values()) {
            totalRequests += timestamps.length;
        }

        return {
            totalIdentities: this.requests.size,
            totalRequests
        };
    }

    /**
     * Reset all limits (useful for testing)
     */
    reset() {
        this.requests.clear();
    }
}

module.exports = SlidingWindowLimiter;
