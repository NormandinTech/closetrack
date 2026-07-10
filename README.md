# CloseTrack AI — Deployment Guide

> From contract to keys. Nothing falls through.
> AI-powered transaction coordination for agents and TCs.

---

## Product Overview

CloseTrack AI has 5 modules:
1. **War Room** — Pipeline dashboard, all deals at a glance
2. **Timeline Generator** — Contract details → complete milestone calendar
3. **Communications** — 9 professional email templates, personalized instantly
4. **Contract Review** — Key term extraction + flag analysis
5. **Deadline Alerts** — Prioritized alert report with action items
6. **TC Assistant** — Ask about deal complications, get expert guidance

---

## Quick Deploy

### Backend (Railway)
1. Push `backend/` to GitHub repo `closetrack-api`
2. Railway → New Project → Deploy from GitHub
3. Add env vars:
   - `ANTHROPIC_API_KEY`
   - `ADMIN_SECRET`
   - `NODE_ENV=production`
4. Note your Railway URL

### Frontend
1. Update `const API = '...'` in `app/index.html` with Railway URL
2. Deploy `landing/`, `app/`, `pwa/` to GitHub Pages or Vercel
3. Generate icons at realfavicongenerator.net → place in `/closetrack/icons/`

---

## Pricing Tiers

| Tier | Price | Transactions | Key prefix |
|------|-------|-------------|-----------|
| Starter | $29/mo | 5 active | CT-STAR- |
| Agent | $59/mo | Unlimited | CT-AGEN- |
| Team | $99/mo | Unlimited, 5 seats | CT-TEAM- |

**Demo key:** `CT-DEMO-00000000`

**Generate key:**
```bash
curl -X POST https://your-url/api/admin/generate-key \
  -H "x-admin-secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"tier":"agent","name":"Jane Smith"}'
```

---

## Three-Product Portfolio Summary

| Product | Market | Price | Color |
|---------|--------|-------|-------|
| PropScribe AI | Listing agents, brokerages | $29–$299/mo | Forest green |
| RentGuard AI | Small landlords (1–10 units) | $19–$79/mo | Teal |
| CloseTrack AI | Agents, TCs, teams | $29–$99/mo | Violet |

All three share the same Anthropic API key and Railway infrastructure pattern.
