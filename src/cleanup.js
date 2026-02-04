/**
 * Automatic cleanup for in-memory rate limit store
 * Prevents memory leaks by periodically removing expired entries
 */

class CleanupManager {
    constructor(limiter, intervalMs = 60000) {
        this.limiter = limiter;
        this.intervalMs = intervalMs;
        this.intervalId = null;
    }

    /**
     * Start periodic cleanup
     */
    start() {
        if (this.intervalId) {
            return; // Already running
        }

        this.intervalId = setInterval(() => {
            this.limiter.cleanup();
        }, this.intervalMs);

        // Don't keep process alive just for cleanup
        if (this.intervalId.unref) {
            this.intervalId.unref();
        }
    }

    /**
     * Stop periodic cleanup
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

module.exports = CleanupManager;
