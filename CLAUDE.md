# Whim — working notes for Claude sessions

Paris pocket-concierge PWA. Production: **https://whim-eta.vercel.app** (Vercel
project `whim`, team `airops-brand`). Static `index.html` + serverless `api/`.
Read `README.md` for the product/architecture overview first.

## Architecture in one breath

- `index.html` contains the whole client: an `x-dc` template (HTML with
  `{{ bindings }}`, `sc-if`, `sc-for`) plus one big `Component extends DCLogic`
  class in a `<script type="text/x-dc">` block. `renderVals()` returns every
  template binding. `support.js` is the runtime — don't edit it.
- `api/*.js` are Vercel Node functions (ESM). Every one degrades gracefully
  when its env key is missing — keep that invariant.
- Data sources: curated `PLACES` array (in index.html) + Google Places
  (`/api/places`, `/api/details`, `/api/discover`) + Instagram pulse, Atlas
  Obscura, TheFork snapshot (Apify actors, `/api/pulse|oddities|book`) +
  Reddit (browser-side pullpush.io; server IPs are blocked) + Supabase
  accounts (`supabase/schema.sql`, config via `/api/config`).

## Hard-won gotchas

- **Edit `index.html` with exact-match string replacement** (python or Edit
  tool) and assert every anchor — the file is ~2.5k lines and blocks repeat.
  After any script edit, extract the `text/x-dc` block and `node --check` it.
- **`/p/<id>` share pages embed a snapshot of PLACES** in `api/p.js` —
  regenerate it whenever curated PLACES changes (see the comment there).
- **CSS `text-transform: uppercase` reaches `innerText`** — tests must match
  case-insensitively.
- **Flex children don't shrink below content height** — card layout bugs
  usually trace to a missing `min-height: 0` or `flex: none`.
- The quiz check-in card occupies deck slot 3; anything guaranteed visible
  must be in the top 2.
- Time-of-day buckets: morning 5–11, afternoon 11–17, evening 17–22, night
  22–5 (midnight belongs to night — this was a real bug once).

## Testing & deploying

```sh
npm install
npm test              # 38-check headless-Chrome suite (tests/smoke.mjs);
                      # CHROME_PATH=/path/to/chrome to use a system browser
vercel deploy         # preview (behind team SSO — use the Vercel MCP tools to fetch)
vercel deploy --prod  # production; env vars live in Vercel, never in the repo
```

Always: run the suite before deploying; commit with a body explaining *why*;
verify the deployed endpoint with a cache-busting query param after.

## Env vars (Vercel)

`ANTHROPIC_API_KEY`, `GOOGLE_PLACES_API_KEY`, `APIFY_TOKEN`, `SUPABASE_URL`,
`SUPABASE_ANON_KEY` (+ optional `CRON_SECRET`). See README for setup states.

## Brand voice

Sassy-but-helpful Paris concierge. Short declaratives, one wink per string,
never mean. Colors: ivory `#fff7f2`, oxblood ink `#451212`, primary red
`#e8432c`; pastel accents pink/indigo/chartreuse/salmon/lilac (ACCENTS map).
All icons are Remixicon (CDN). New copy must sound like the existing copy.
