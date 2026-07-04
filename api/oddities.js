// Atlas Obscura layer — hidden-gem/oddity inventory for off-the-beaten-path
// taste profiles, via the crawlergang/atlas-obscura-scraper Apify actor.
// GET            -> items from the last successful run (edge-cached 6h)
// GET ?refresh=1 -> kick a fresh run (weekly cron; guarded by CRON_SECRET when set)

const ACTOR = 'crawlergang~atlas-obscura-scraper';
const PARIS = { latitude: 48.859, longitude: 2.36 };

export default async function handler(req, res) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(200).json({ ok: false, reason: 'no_key' });

  if (req.query.refresh) {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ ok: false, reason: 'unauthorized' });
    }
    try {
      const r = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'byLocation', ...PARIS, radius: 12, maxItems: 25, fetchDetails: true,
        }),
      });
      const j = await r.json();
      return res.status(200).json({ ok: r.ok, started: j?.data?.id || null });
    } catch (e) {
      return res.status(200).json({ ok: false, reason: 'start_failed' });
    }
  }

  try {
    const r = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs/last/dataset/items?token=${token}&status=SUCCEEDED&limit=50`);
    if (!r.ok) return res.status(200).json({ ok: false, reason: `apify_${r.status}` });
    const items = await r.json();
    if (!Array.isArray(items) || !items.length) {
      return res.status(200).json({ ok: false, reason: 'no_run_yet' });
    }

    const seen = new Set();
    const places = items
      .map((p) => ({
        name: String(p.name || '').trim().slice(0, 90),
        blurb: String(p.subtitle || p.description || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        url: p.placeUrl || p.url || null,
        // field names vary by actor version — accept both spellings
        lat: p.lat ?? p.latitude ?? null,
        lng: p.lng ?? p.longitude ?? null,
        category: p.category || null,
      }))
      .filter((p) => p.name)
      .filter((p) => {
        const k = p.name.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 25);

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=604800');
    return res.status(200).json({ ok: true, places });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
