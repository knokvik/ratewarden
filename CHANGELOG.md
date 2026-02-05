# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-02-05

### Documentation
- 📚 **Complete README overhaul** for production credibility
  - Added "Why ratewarden Exists" section explaining the gap between simple and complex solutions
  - Added **critical "When NOT to Use ratewarden" section** with honest limitations
  - Documented multi-node deployment limitations (in-memory only)
  - Documented throughput limits (~5,000-10,000 req/sec guidance)
  - Explained why it's not a replacement for API gateways
- ⚡ **Performance & Benchmarks section** with real-world numbers
  - Tested throughput metrics on Node 18+
  - Memory usage patterns and scaling behavior
  - Sliding window algorithm trade-offs
- 🎯 **Improved HTTP Headers documentation**
  - Complete 429 response structure with examples
  - Detailed explanation of all RateLimit-* headers
  - Retry-After header meaning and usage
- 🗺️ **Enhanced Roadmap** with clear version milestones (v1.1, v2.0, v2.x+)
- 📖 **Table of Contents** for better README navigation

### Examples
- ✨ **New structured example folder**: `examples/express-basic/`
  - Runnable in under 1 minute
  - Complete with README and testing instructions
  - Demonstrates anonymous vs authenticated requests
  - Shows rate limit headers in action
  - Includes helpful console output and curl commands

### Package Metadata
- 🔗 Added `bugs` URL for GitHub issues
- 🏠 Added `homepage` URL
- 🏷️ Expanded keywords for better npm discoverability
  - Added: sliding-window, zero-config, ddos-protection, api-protection, request-limiting, nodejs

### Added
- Table of contents in README for better navigation
- Comparison table with express-rate-limit and rate-limiter-flexible
- Design philosophy section ("Batteries included, but removable")
- TypeScript interface documentation for configuration options
- Support section with links to docs, issues, and discussions

### Changed
- README tone: more professional, honest, and less marketing-focused
- Clearer positioning: "small to medium Node.js APIs" instead of "all APIs"
- Removed hype, added honesty about trade-offs

### Notes
**This is a documentation-focused release.** No breaking changes to the API.
The goal is to improve trust and clarity for production use cases.

## [1.0.0] - 2026-02-04

### Added
- 🎉 Initial release of ratewarden
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
