# Express Basic Example

A minimal, runnable example of `ratewarden` in an Express application.

## What This Demonstrates

- ✅ Zero-configuration setup (one line of code)
- ✅ Automatic identity detection (token vs. IP)
- ✅ Tier-based rate limiting (guest: 30/min, authenticated: 60/min)
- ✅ Standard HTTP rate limit headers
- ✅ 429 error handling

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Server

```bash
node index.js
```

You should see:

```
🚀 ratewarden demo server running on http://localhost:3000

Try these commands:

  # Anonymous (guest tier: 30 req/min)
  curl http://localhost:3000/api/data

  # Authenticated (free tier: 60 req/min)
  curl -H "Authorization: Bearer demo-token" http://localhost:3000/api/data

  # Check status
  curl http://localhost:3000/api/status

  # Trigger rate limit (run this 35+ times quickly)
  for i in {1..35}; do curl http://localhost:3000/api/data; done
```

## Testing Rate Limiting

### Test 1: Anonymous Request (Guest Tier)

```bash
curl -i http://localhost:3000/api/data
```

**Expected response:**

```http
HTTP/1.1 200 OK
RateLimit-Limit: 30
RateLimit-Remaining: 29
RateLimit-Reset: 1738759260

{
  "message": "Success! You are within your rate limit.",
  ...
}
```

Notice the `RateLimit-*` headers showing 30 requests per minute for anonymous users.

### Test 2: Authenticated Request (Free Tier)

```bash
curl -i -H "Authorization: Bearer my-token" http://localhost:3000/api/data
```

**Expected response:**

```http
HTTP/1.1 200 OK
RateLimit-Limit: 60
RateLimit-Remaining: 59
RateLimit-Reset: 1738759260

{
  "message": "Success! You are within your rate limit.",
  ...
}
```

Notice the limit increased to 60 because ratewarden detected the `Authorization` header.

### Test 3: Trigger Rate Limit

Run this command to make 35 requests quickly (exceeds the 30 req/min guest limit):

```bash
for i in {1..35}; do 
  curl http://localhost:3000/api/data 
  echo ""
done
```

**After the 31st request, you'll see:**

```http
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 30
RateLimit-Remaining: 0
RateLimit-Reset: 1738759260
Retry-After: 45

{
  "error": "Too many requests",
  "message": "Rate limit exceeded for tier 'guest'",
  "tier": "guest",
  "limit": 30,
  "current": 31,
  "retryAfter": 45
}
```

The `Retry-After` header tells you how many seconds to wait.

### Test 4: Check Your Status

```bash
curl http://localhost:3000/api/status
```

**Response:**

```json
{
  "yourRateLimits": {
    "limit": "30",
    "remaining": "25",
    "resetAt": "2026-02-05T12:34:20.000Z"
  },
  "identity": {
    "hasAuthToken": false,
    "hasUserId": false,
    "ip": "::1"
  }
}
```

This shows how many requests you have left and when your limit resets.

## Understanding the Code

The entire setup is just 3 lines:

```javascript
const express = require('express');
const ratewarden = require('ratewarden');

const app = express();
app.use(ratewarden()); // 🎯 This is all you need!
```

**How it works:**

1. **Identity Detection:** ratewarden automatically checks for:
   - `Authorization` header (Bearer tokens, API keys)
   - `x-user-id` header
   - IP address as fallback

2. **Tier Assignment:**
   - Users with auth tokens → `free` tier (60 req/min)
   - Anonymous users → `guest` tier (30 req/min)

3. **Rate Limiting:**
   - Uses a sliding window algorithm
   - Tracks timestamps in memory
   - Automatically cleans up expired data

## Next Steps

- Check out the [main README](../../README.md) for advanced configuration
- See [examples/advanced.js](../advanced.js) for custom tiers and identity logic
- Read about [when NOT to use ratewarden](../../README.md#when-not-to-use-ratewarden)

## Package.json

This example uses the `ratewarden` package from the parent directory (via `../../src/index`).

In your own project, install it with:

```bash
npm install ratewarden
```

Then import with:

```javascript
const ratewarden = require('ratewarden');
```

---

**Questions?** Open an issue at [github.com/knokvik/ratewarden/issues](https://github.com/knokvik/ratewarden/issues)
