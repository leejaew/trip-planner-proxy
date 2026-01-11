# Trip Planner Proxy

A Cloudflare Worker that proxies geocoding and routing requests to OpenStreetMap services with proper headers and simplified responses.

## What It Does

Provides 4 endpoints that forward requests to free mapping APIs:

- `/geocode/search` - Search for locations (powered by Nominatim)
- `/geocode/reverse` - Get address from coordinates (powered by Nominatim)
- `/route` - Calculate route between waypoints (powered by OSRM)
- `/table` - Calculate distance/duration matrix (powered by OSRM)

The proxy adds required User-Agent headers and contact emails to comply with OpenStreetMap usage policies, and normalizes responses to a consistent JSON format.

## Deployment on Cloudflare

### 1. Prerequisites
- Cloudflare account
- Wrangler CLI installed: `npm install -g wrangler`

### 2. Deploy
```bash
# Login to Cloudflare
wrangler login

# Deploy the worker
wrangler deploy trip-planner-proxy-worker.js
```

### 3. Configure Environment Variables (Optional)
```bash
wrangler secret put USER_AGENT
# Enter: YourApp/1.0

wrangler secret put CONTACT_EMAIL
# Enter: your@email.com
```

Or set them in the Cloudflare dashboard under Workers > Your Worker > Settings > Variables.

### 4. Use Your Worker
Your worker will be available at: `https://trip-planner-proxy.<your-subdomain>.workers.dev`

## Example Usage

```bash
# Search for a location
curl "https://your-worker.workers.dev/geocode/search?q=Paris"

# Reverse geocode
curl "https://your-worker.workers.dev/geocode/reverse?lat=48.8566&lon=2.3522"

# Get route info
curl "https://your-worker.workers.dev/route?coordinates=2.3522,48.8566;-0.1276,51.5074"

# Distance matrix
curl "https://your-worker.workers.dev/table?coordinates=2.3522,48.8566;-0.1276,51.5074"
```

## License

MIT