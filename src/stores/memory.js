/**
 * In-memory store for rate limiting
 * Uses sliding window counter algorithm with timestamp tracking
 * 
 * Best for: Single-server deployments, development, small-to-medium traffic
 * Note: State is local to each process (not shared across servers)
 */

class MemoryStore {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60000;
        // Map<identityKey, Array<timestamp>>
        this.requests = new Map();
    }

    /**
     * Check if a request should be allowed and increment counter
     * @param {string} identityKey - Unique identifier for the requester
     * @param {number} limit - Maximum requests allowed in window
     * @returns {Promise<object>} - { allowed: boolean, current: number, remaining: number, resetTime: number, retryAfter: number }
     */
    async checkLimit(identityKey, limit) {
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
     * Should be called periodically by CleanupManager
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
     * @returns {Promise<object>} - { totalIdentities: number, totalRequests: number }
     */
    async getStats() {
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
    async reset() {
        this.requests.clear();
    }

    /**
     * Check if store is ready (always true for memory)
     */
    async isReady() {
        return true;
    }

    /**
     * Close/cleanup (no-op for memory store)
     */
    async close() {
        // No cleanup needed for in-memory
    }
}

/**
 * Factory function to create memory store
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds
 * @returns {MemoryStore} - Memory store instance
 */
function createMemoryStore(options = {}) {
    return new MemoryStore(options);
}

module.exports = createMemoryStore;
module.exports.MemoryStore = MemoryStore;
