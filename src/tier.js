/**
 * Tier resolution and default tier configuration
 */

// Default tier limits (requests per window)
const DEFAULT_TIERS = {
    free: 60,      // Authenticated users (token or user ID)
    pro: 600,      // Premium users
    admin: Infinity, // Unlimited
    guest: 30      // Anonymous users (IP only)
};

// Default window: 60 seconds
const DEFAULT_WINDOW_MS = 60 * 1000;

/**
 * Resolve tier based on identity source or custom resolver
 * @param {object} req - Express request object
 * @param {string} source - Identity source ('token', 'userId', 'ip')
 * @param {function} customResolver - Optional custom tier resolver
 * @returns {string} - Tier name
 */
function resolveTier(req, source, customResolver) {
    // Use custom resolver if provided
    if (customResolver && typeof customResolver === 'function') {
        const customTier = customResolver(req);
        if (customTier) return customTier;
    }

    // Default tier resolution based on identity source
    if (source === 'token' || source === 'userId') {
        return 'free'; // Authenticated users get free tier by default
    }

    return 'guest'; // Anonymous (IP-only) users are guests
}

/**
 * Get limit for a given tier
 * @param {string} tier - Tier name
 * @param {object} tiers - Tier configuration object
 * @returns {number} - Request limit
 */
function getTierLimit(tier, tiers) {
    const config = tiers || DEFAULT_TIERS;
    return config[tier] !== undefined ? config[tier] : config.free;
}

module.exports = {
    resolveTier,
    getTierLimit,
    DEFAULT_TIERS,
    DEFAULT_WINDOW_MS
};
