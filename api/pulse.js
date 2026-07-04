// City pulse — what's happening in Paris right now, scraped from Instagram via Apify.
// GET            -> items from the actor's last successful run (edge-cached 1h)
// GET ?refresh=1 -> kick off a fresh scrape run (fire-and-forget; guarded by CRON_SECRET when set)
// Degrades to { ok:false, reason:'no_key' } without APIFY_TOKEN.

const ACTOR = process.env.APIFY_ACTOR || 'apify~instagram-hashtag-scraper';
const HASHTAGS = ['quefaireaparis', 'parisevents', 'sortiraparis', 'parisjetaime'];

export default async function handler(req, res) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(200).json({ ok: false, reason: 'no_key' });

  if (req.query.refresh) {
    // Vercel cron sends `Authorization: Bearer ${CRON_SECRET}` when the env var is set.
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ ok: false, reason: 'unauthorized' });
    }
    try {
      const r = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtags: HASHTAGS, resultsLimit: 30 }),
      });
      const j = await r.json();
      return res.status(200).json({ ok: r.ok, started: j?.data?.id || null });
    } catch (e) {
      return res.status(200).json({ ok: false, reason: 'start_failed' });
    }
  }

  try {
    const url = `https://api.apify.com/v2/acts/${ACTOR}/runs/last/dataset/items?token=${token}&status=SUCCEEDED&limit=200`;
    const r = await fetch(url);
    if (!r.ok) return res.status(200).json({ ok: false, reason: `apify_${r.status}` });
    const items = await r.json();
    if (!Array.isArray(items) || !items.length) {
      return res.status(200).json({ ok: false, reason: 'no_run_yet' });
    }

    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const seen = new Set();
    const pulse = items
      .map((p) => ({
        text: String(p.caption || '').replace(/\s+/g, ' ').trim().slice(0, 280),
        url: p.url || null,
        when: p.timestamp || null,
        likes: p.likesCount ?? 0,
        spot: p.locationName || null,
      }))
      .filter((p) => p.text && (!p.when || Date.parse(p.when) > weekAgo))
      .filter((p) => {
        const key = p.text.slice(0, 60).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 12);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ ok: true, pulse });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
