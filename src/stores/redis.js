/**
 * Redis store for distributed rate limiting
 * Uses sorted sets for sliding window counter algorithm
 * 
 * Best for: Multi-server deployments, distributed systems, high availability
 * Note: Requires redis npm package (^4.0.0) and a Redis server
 * 
 * Architecture:
 * - Each identity+tier gets a sorted set: ratewarden:{tier}:{identityKey}
 * - Score = timestamp (milliseconds)
 * - Member = unique ID (timestamp + random)
 * - ZREMRANGEBYSCORE removes expired entries
 * - ZCARD counts requests in window
 * - ZADD adds new request
 * - Keys auto-expire after windowMs * 2 (safety margin)
 */

/**
 * Redis store implementation
 */
class RedisStore {
    constructor(redisClient, options = {}) {
        if (!redisClient) {
            throw new Error('[ratewarden] Redis client is required. Pass a connected redis client instance.');
        }

        this.client = redisClient;
        this.windowMs = options.windowMs || 60000;
        this.prefix = options.prefix || 'ratewarden:';
        this.isConnected = false;

        // Check if client is already connected
        this._checkConnection();
    }

    /**
     * Check Redis connection status
     * @private
     */
    async _checkConnection() {
        try {
            if (this.client.isReady) {
                this.isConnected = true;
            } else if (this.client.isOpen) {
                this.isConnected = true;
            } else {
                // Try to ping
                await this.client.ping();
                this.isConnected = true;
            }
        } catch (error) {
            this.isConnected = false;
            throw new Error(`[ratewarden] Redis connection failed: ${error.message}`);
        }
    }

    /**
     * Generate Redis key for identity
     * @private
     */
    _getKey(identityKey, tier = 'default') {
        return `${this.prefix}${tier}:${identityKey}`;
    }

    /**
     * Check if a request should be allowed and increment counter
     * Uses sliding window algorithm with Redis sorted sets
     * 
     * @param {string} identityKey - Unique identifier for the requester
     * @param {number} limit - Maximum requests allowed in window
     * @param {string} [tier='default'] - Tier name for key namespacing
     * @returns {Promise<object>} - { allowed: boolean, current: number, remaining: number, resetTime: number, retryAfter: number }
     */
    async checkLimit(identityKey, limit, tier = 'default') {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        const key = this._getKey(identityKey, tier);

        try {
            // Use a pipeline for atomic operations (Redis >=4.0 uses multi())
            const multi = this.client.multi();

            // Step 1: Remove expired entries (outside sliding window)
            multi.zRemRangeByScore(key, 0, windowStart);

            // Step 2: Count current requests in window
            multi.zCard(key);

            // Step 3: Get oldest timestamp (for reset time calculation)
            multi.zRange(key, 0, 0, { REV: false });

            // Execute pipeline
            const results = await multi.exec();

            // Parse results (results is an array of values)
            const currentCount = results[1] || 0;
            const oldestEntries = results[2] || [];

            // Calculate reset time
            let resetTime;
            if (oldestEntries.length > 0 && oldestEntries[0]) {
                // Parse timestamp from the member (format: "timestamp-random")
                const oldestTimestamp = parseInt(oldestEntries[0].split('-')[0]);
                resetTime = Math.ceil((oldestTimestamp + this.windowMs) / 1000);
            } else {
                resetTime = Math.ceil((now + this.windowMs) / 1000);
            }

            // Check if limit exceeded
            if (currentCount >= limit) {
                // Calculate retry after
                let retryAfter = 0;
                if (oldestEntries.length > 0 && oldestEntries[0]) {
                    const oldestTimestamp = parseInt(oldestEntries[0].split('-')[0]);
                    retryAfter = Math.ceil((oldestTimestamp + this.windowMs - now) / 1000);
                }

                return {
                    allowed: false,
                    current: currentCount,
                    remaining: 0,
                    resetTime,
                    retryAfter
                };
            }

            // Step 4: Add current request (use unique member to allow duplicates at same ms)
            const member = `${now}-${Math.random().toString(36).substr(2, 9)}`;
            await this.client.zAdd(key, { score: now, value: member });

            // Step 5: Set expiration (TTL = window * 2 for safety)
            const ttlSeconds = Math.ceil(this.windowMs / 1000) * 2;
            await this.client.expire(key, ttlSeconds);

            return {
                allowed: true,
                current: currentCount + 1,
                remaining: limit - currentCount - 1,
                resetTime,
                retryAfter: 0
            };

        } catch (error) {
            throw new Error(`[ratewarden] Redis error in checkLimit: ${error.message}`);
        }
    }

    /**
     * Cleanup (Redis handles this automatically via TTL)
     * This is a no-op for compatibility with MemoryStore interface
     */
    cleanup() {
        // Redis automatically expires keys via TTL
        // No manual cleanup needed
    }

    /**
     * Get current stats (approximate)
     * Note: This scans keys and can be expensive on large datasets
     * @returns {Promise<object>} - { totalIdentities: number, totalRequests: number }
     */
    async getStats() {
        try {
            // Scan for all ratewarden keys
            const keys = await this.client.keys(`${this.prefix}*`);
            let totalRequests = 0;

            // Count requests in each key
            for (const key of keys) {
                const count = await this.client.zCard(key);
                totalRequests += count;
            }

            return {
                totalIdentities: keys.length,
                totalRequests
            };
        } catch (error) {
            throw new Error(`[ratewarden] Redis error in getStats: ${error.message}`);
        }
    }

    /**
     * Reset all limits (useful for testing)
     * WARNING: This deletes ALL ratewarden keys
     */
    async reset() {
        try {
            const keys = await this.client.keys(`${this.prefix}*`);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
        } catch (error) {
            throw new Error(`[ratewarden] Redis error in reset: ${error.message}`);
        }
    }

    /**
     * Check if store is ready
     */
    async isReady() {
        try {
            await this.client.ping();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Close Redis connection
     * Note: Usually you manage the Redis client lifecycle yourself
     */
    async close() {
        // Don't close the client - user manages it
        // this is just for interface compatibility
    }
}

/**
 * Factory function to create Redis store
 * 
 * @param {Object} redisClient - Connected redis client instance (from 'redis' package v4+)
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {string} options.prefix - Redis key prefix (default: 'ratewarden:')
 * @returns {RedisStore} - Redis store instance
 * 
 * @example
 * const { createClient } = require('redis');
 * const client = await createClient().connect();
 * const store = createRedisStore(client, { windowMs: 60000, prefix: 'myapp:' });
 */
function createRedisStore(redisClient, options = {}) {
    return new RedisStore(redisClient, options);
}

module.exports = createRedisStore;
module.exports.RedisStore = RedisStore;
