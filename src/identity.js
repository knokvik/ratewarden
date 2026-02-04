const crypto = require('crypto');

/**
 * Identity resolution for rate limiting
 * Priority: Authorization token > x-user-id header > IP address
 */

/**
 * Hash a string using SHA-256 to create a consistent identity key
 * @param {string} value - The value to hash
 * @returns {string} - Hex-encoded hash
 */
function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Extract identity from Authorization header
 * Supports: Bearer tokens, API keys, Basic auth
 * @param {object} req - Express request object
 * @returns {string|null} - Hashed token or null
 */
function extractFromAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return null;

  // Extract token from "Bearer <token>" or use raw header
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  return token ? hashValue(token) : null;
}

/**
 * Extract identity from custom user header
 * @param {object} req - Express request object
 * @returns {string|null} - Hashed user ID or null
 */
function extractFromUserHeader(req) {
  const userId = req.headers['x-user-id'];
  return userId ? hashValue(String(userId)) : null;
}

/**
 * Extract identity from IP address (fallback)
 * @param {object} req - Express request object
 * @returns {string} - Hashed IP address
 */
function extractFromIP(req) {
  // Support proxied requests (x-forwarded-for, x-real-ip)
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.ip
    || req.connection?.remoteAddress
    || 'unknown';

  return hashValue(ip);
}

/**
 * Resolve identity key for rate limiting
 * Uses priority chain: Auth token > User header > IP
 * @param {object} req - Express request object
 * @returns {object} - { key: string, source: 'token'|'userId'|'ip' }
 */
function resolveIdentity(req) {
  // Priority 1: Authorization header
  const tokenKey = extractFromAuth(req);
  if (tokenKey) {
    return { key: tokenKey, source: 'token' };
  }

  // Priority 2: x-user-id header
  const userIdKey = extractFromUserHeader(req);
  if (userIdKey) {
    return { key: userIdKey, source: 'userId' };
  }

  // Priority 3: IP address (fallback)
  const ipKey = extractFromIP(req);
  return { key: ipKey, source: 'ip' };
}

module.exports = {
  resolveIdentity,
  hashValue
};
