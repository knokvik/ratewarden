# Ratewarden

**A zero-config, identity-aware, tier-based rate limiter for Node.js APIs**

Stop API abuse without the hassle. `ratewarden` automatically understands who is making requests and applies intelligent rate limits based on user tiers.

## Why Ratewarden?

Most rate limiters are either:
- **Too simple**: Only rate limit by IP (breaks for shared networks)
- **Too complex**: Require Redis, complex configuration, or 20+ options

`ratewarden` is the Goldilocks solution:
- **Zero-config**: Works out of the box with sensible defaults
- **Identity-aware**: Automatically detects users from tokens, headers, or IP
- **Tier-based**: Different limits for free, pro, admin users
- **Standard headers**: Uses draft IETF RateLimit headers
- **No dependencies**: Pure Node.js, no Redis required (but Redis supported for distributed systems)
- **Production-ready**: Memory-safe with automatic cleanup
- **Scales up**: Optional Redis support for multi-server deployments

## Quick Start

### Installation

```bash
npm install ratewarden
```

### Basic Usage (Zero Config)

```javascript
const express = require('express');
const ratewarden = require('ratewarden');

const app = express();

// That's it! One line of code.
app.use(ratewarden());

app.get('/api/data', (req, res) => {
  res.json({ message: 'Success!' });
});

app.listen(3000);
```

**Default limits:**
- Authenticated users (token/user ID): **60 requests / minute**
- Anonymous users (IP only): **30 requests / minute**

## How It Works

### Smart Identity Resolution

`ratewarden` automatically figures out WHO is making the request:

```
Request → Check Authorization header (JWT/API key) 
       → Check x-user-id header
       → Fall back to IP address
```

This means:
- Users with auth tokens get their own limits
- Shared WiFi (coffee shops, offices) doesn't break your API
- Anonymous users still get protected

### Automatic Tier Assignment

Based on identity, users are automatically assigned tiers:

| Identity Source | Default Tier | Limit |
|----------------|--------------|-------|
| Authorization token | `free` | 60/min |
| x-user-id header | `free` | 60/min |
| IP address only | `guest` | 30/min |

## Advanced Usage

### Custom Tiers

```javascript
app.use(ratewarden({
  windowMs: 60000, // 1 minute
  tiers: {
    free: 100,
    pro: 1000,
    admin: Infinity
  }
}));
```

### Custom Tier Resolution

Map request to tier based on user data:

```javascript
app.use(ratewarden({
  resolveTier: (req) => {
    // Assuming you have auth middleware that sets req.user
    if (req.user?.plan === 'premium') return 'pro';
    if (req.user?.isAdmin) return 'admin';
    return 'free';
  }
}));
```

### Custom Identity Key

```javascript
app.use(ratewarden({
  keyGenerator: (req) => {
    // Rate limit by organization ID instead of user
    return req.user?.organizationId || req.ip;
  }
}));
```

### Custom Error Handling

```javascript
app.use(ratewarden({
  onLimitReached: (req, res, info) => {
    console.log(`Rate limit hit: ${info.tier}, ${info.current}/${info.limit}`);
    // Still sends 429, but you can log/alert
  }
}));
```

### Route-Specific Limits

```javascript
// Strict limits on auth endpoints
app.use('/auth', ratewarden({
  tiers: { guest: 5 },
  windowMs: 60000
}));

// Relaxed limits on public API
app.use('/api', ratewarden({
  tiers: { guest: 100 },
  windowMs: 60000
}));
```

### Using with Redis (Distributed Systems)

For **multi-server deployments**, use Redis to share rate limit state across all servers:

#### Installation

```bash
npm install redis
```

#### Basic Setup

```javascript
const { createClient } = require('redis');
const ratewarden = require('ratewarden');

// Create and connect Redis client
const redisClient = await createClient({
  url: 'redis://localhost:6379'
}).connect();

// Pass redisClient to ratewarden
app.use(ratewarden({
  redisClient
}));
```

#### Full Example with Options

```javascript
const redisClient = await createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  // Optional: configure connection pooling, timeouts, etc.
}).connect();

app.use(ratewarden({
  windowMs: 60000,
  tiers: {
    guest: 30,
    free: 100,
    pro: 1000
  },
  redisClient,
  redisPrefix: 'myapp:ratelimit:', // Custom key prefix
  onLimitReached: (req, res, info) => {
    console.log(`Rate limit exceeded: ${info.tier}`);
  }
}));
```

#### When to Use Redis

**Use Redis when:**
- You have multiple app servers (horizontal scaling)
- You need consistent rate limits across servers
- You deploy with Docker/Kubernetes (multiple pods)
- You use serverless/edge functions (shared state needed)

**Use in-memory when:**
- Single server deployment
- Development/testing
- Simplicity is more important than distributed state

#### Redis Architecture

Under the hood, `ratewarden` uses **Redis sorted sets** for sliding window:

```
Key: ratewarden:{tier}:{identityKey}
Value: Sorted set of timestamps
Score: Request timestamp (ms)
TTL: 2x windowMs (auto-cleanup)
```

Example:
```
ratewarden:free:user123 → ZSET { 
  1678900001234: "1678900001234-abc123",
  1678900005678: "1678900005678-def456"
}
```

Operations:
- `ZREMRANGEBYSCORE` → Remove expired requests
- `ZCARD` → Count requests in window
- `ZADD` → Add new request
- Keys auto-expire via `EXPIRE` command

**Benefits:**
- Atomic operations (no race conditions)
- Distributed consistency
- Automatic cleanup via TTL
- O(log N) performance


## HTTP Headers

`ratewarden` follows the [IETF RateLimit Headers draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/):

### On Success (200)
```
RateLimit-Limit: 60
RateLimit-Remaining: 45
RateLimit-Reset: 1700000123
```

### On Limit Exceeded (429)
```
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 60
RateLimit-Remaining: 0
RateLimit-Reset: 1700000123
Retry-After: 24

{
  "error": "Too many requests",
  "message": "Rate limit exceeded for tier 'free'",
  "tier": "free",
  "limit": 60,
  "current": 60,
  "retryAfter": 24
}
```

## Architecture

### Algorithm: Sliding Window Counter

Instead of fixed buckets, `ratewarden` uses a sliding window:

```
Window = 60 seconds
Limit = 3 requests

Time: 0s    15s   30s   45s   60s
Req:  ✓     ✓     ✓     ✗     ✓
      OK    OK    OK    429   OK (first request expired)
```

**Benefits:**
- More accurate than fixed windows
- No sudden bursts at window boundaries
- O(1) check per request

### Memory Management

- Automatic cleanup of expired timestamps
- Background cleanup runs every minute
- No memory leaks on long-running servers

## Comparison with Other Libraries

| Feature | ratewarden | express-rate-limit | rate-limiter-flexible |
|---------|-----------|-------------------|---------------------|
| Zero-config | Yes | No (requires config) | No (requires Redis) |
| Identity-aware | Yes | No (IP only by default) | Manual setup |
| Tier-based | Built-in | Custom code | Custom code |
| Dependencies | None (Redis optional) | None | Redis required |
| Distributed support | Yes (via Redis) | No | Yes |
| Setup time | 30 seconds | 5 minutes | 30+ minutes |
| Best for | Small to large APIs, MVPs to Production | Customizable setups | Enterprise only |

## Configuration Options

```typescript
interface RateGuardOptions {
  // Time window in milliseconds (default: 60000)
  windowMs?: number;
  
  // Tier configuration (default: { free: 60, pro: 600, admin: Infinity, guest: 30 })
  tiers?: Record<string, number>;
  
  // Custom tier resolver
  resolveTier?: (req) => string;
  
  // Custom identity key generator
  keyGenerator?: (req) => string;
  
  // Callback when limit is reached
  onLimitReached?: (req, res, info) => void;
  
  // Redis client for distributed rate limiting (optional)
  redisClient?: RedisClientType;
  
  // Redis key prefix (default: 'ratewarden:')
  redisPrefix?: string;
}
```

## Testing

Run tests:

```bash
npm test
```

Expected output:
```
✓ All tests passed!
Passed: 15
Failed: 0
```

## Use Cases

Perfect for:
- **Hackathon projects**: Deploy protection in 30 seconds
- **MVPs and prototypes**: No infrastructure overhead
- **SaaS APIs**: Built-in tier support
- **Learning projects**: Simple, readable code
- **Single-server deployments**: Zero-config in-memory storage
- **Multi-server deployments**: Optional Redis for distributed state

Not ideal for:
- Extremely high traffic (>10k req/sec per endpoint per server)
- Complex sliding window with exact distributed fairness guarantees
- Sub-millisecond precision requirements

## Roadmap

**v1.0** (Released)
- Sliding window algorithm
- Identity resolution
- Tier-based limits
- Standard headers
- In-memory storage

**v1.1** (Current)
- Redis adapter for distributed systems
- Store abstraction layer
- Backward-compatible API

**v2.0** (Future)
- [ ] Prometheus metrics export
- [ ] Rate limit analytics dashboard
- [ ] Fastify and Koa adapters
- [ ] GraphQL query complexity integration

## Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create a feature branch
3. Add tests for new features
4. Submit a PR

## License

MIT © Niraj Rajendra Naphade

## Philosophy

**Batteries included, but removable.**

`ratewarden` makes the 90% use case trivial while still allowing customization for the other 10%.

---

**Made for developers who want protection without complexity**
