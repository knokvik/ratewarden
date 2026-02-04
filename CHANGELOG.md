# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-04

### Added
- 🎉 Initial release of rate-guard
- Zero-config rate limiting middleware for Express.js
- Smart identity resolution (Authorization header → x-user-id → IP)
- Tier-based rate limiting (free, pro, admin, guest)
- Sliding window counter algorithm
- Standard HTTP RateLimit headers (draft-ietf-httpapi-ratelimit-headers)
- Automatic memory cleanup
- Comprehensive test suite
- Example applications (basic and advanced)

### Features
- **Identity Resolution**: Automatic detection of users from tokens, headers, or IP
- **Tier System**: Built-in support for multi-tier rate limiting
- **HTTP Standards**: Proper 429 responses with Retry-After headers
- **Memory Safe**: Automatic cleanup prevents memory leaks
- **Zero Dependencies**: Pure Node.js implementation
- **Extensible**: Custom tier resolvers, key generators, and callbacks

### Documentation
- Complete README with examples and comparisons
- API documentation for all configuration options
- Use case guidelines
- Architecture explanation

---

## [Unreleased]

### Planned for v2.0
- Redis adapter for distributed systems
- Prometheus metrics support
- Rate limit analytics dashboard
- Fastify framework support
- Additional algorithms (token bucket, leaky bucket)
- Per-route limit configuration helpers
