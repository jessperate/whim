# Whim — swipe right on Paris

A pocket concierge for Paris. Take a ten-question taste quiz, swipe on curated
spots, and Whim drafts your day around your **real location, the real clock,
and the real weather** — with a Claude-powered concierge to argue with.

**Live:** deployed on Vercel (`airops-brand/whim`) · **Repo:** `jessperate/whim`

## How it works

Single-page app (`index.html`) on a tiny custom runtime (`support.js`), plus
three Vercel serverless functions:

| Piece | What it does |
|---|---|
| `index.html` | The whole UI + client logic. 36 curated, taste-tagged Paris spots with coordinates. Geolocation (falls back to the Marais; >30 km away = "planning from afar"), haversine distances, Paris-time clock/weekday, Open-Meteo live weather. Taste profile, swipes and chat persist in `localStorage`. |
| `api/concierge.js` | Claude (`claude-opus-4-8`, adaptive thinking) with the Whim persona. Gets your taste file, likes, current deck, live context and city pulse. Same-origin gate + payload caps. |
| `api/places.js` | Google Places API (New) text search proxy — live rating, review count, open-now per card. Edge-cached 24 h. |
| `api/pulse.js` | Timely Paris happenings scraped from Instagram hashtags via Apify's REST API. `?refresh=1` starts a new scrape (daily cron in `vercel.json`); plain GET serves the last successful run. Feeds the concierge. |

Everything degrades gracefully: no key → baked-in ratings, offline concierge
one-liners, empty pulse.

## Environment variables (Vercel → Settings → Environment Variables)

| Var | Required for | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Concierge chat | ✅ configured |
| `GOOGLE_PLACES_API_KEY` | Live ratings / open-now | ✅ configured — Places API (New) must be enabled on the GCP project |
| `APIFY_TOKEN` | City pulse | ⬜ not yet set — from apify.com → Settings → API tokens. First data appears after the first run (cron at 06:00 UTC, or hit `/api/pulse?refresh=1` once) |
| `CRON_SECRET` | Optional | If set, `?refresh=1` requires the Vercel cron's bearer token |
| `APIFY_ACTOR` | Optional | Defaults to `apify~instagram-hashtag-scraper` |
| `SUPABASE_URL` | Accounts & friends | ⬜ not yet set — project URL from Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Accounts & friends | ⬜ not yet set — public anon key; safe to expose, RLS guards the data |

## Accounts & friends (Supabase)

Optional — without the two env vars the app stays a local-only guest
experience. Signed in, the taste file, likes/plan, saved places and reviews
sync across devices (`profiles`, `swipes`, `hearts`, `reviews`,
`friendships` tables), and you can add friends by @handle and browse their
saves, likes and reviews.

One-time setup (~10 min):

1. Create a project at supabase.com (pick an EU region — the app is Paris-first).
2. SQL editor → paste and run `supabase/schema.sql` (tables, signup trigger, RLS).
3. Auth → Sign In / Up: keep Email enabled; for instant signup while
   prototyping, turn **off** "Confirm email". Optionally configure the Google
   provider to activate the "Continue with Google" button.
4. Settings → API: copy the project URL + anon key into `SUPABASE_URL` /
   `SUPABASE_ANON_KEY` (Vercel env vars, plus `.env.local` for `vercel dev`),
   then redeploy.

Guest data is adopted into the account on first sign-in; after that the server
copy wins and other devices sync down. "Wipe my taste file" clears the server
copy too.

## Develop & deploy

```sh
npm install          # SDK for api/concierge.js
vercel dev           # local, with functions (add keys to .env.local)
vercel deploy        # preview
vercel deploy --prod # production
```

The You tab has context overrides (time of day / weather) for demoing the
deck filtering without waiting for rain.

## Testing

A 12-check headless-Chrome smoke suite (boot → quiz → deck → swipe → plan →
chat → geolocation) lives in the session scratchpad (`smoke/smoke.mjs`); it
stubs the API routes and drives the real UI. Re-create from git history or ask
Claude to regenerate it.

## Design system

Serrif VF (display) + Saans/Saans Mono, brand green `#00ff64` on `#002910`,
category accent palette (pink food / indigo culture / green outdoors / yellow
nights). Card photos come from Wikipedia summaries; cards without a photo use
the dotted accent art.
