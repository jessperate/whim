// Real-time table availability via the clearpath/resy-api Apify actor.
// GET ?name=<restaurant>&date=YYYY-MM-DD&party=N
// Runs the actor synchronously (run-sync-get-dataset-items) with a tight
// maxItems, returns bookable slots + the Resy URL. Availability is cached
// briefly at the edge; pricing is per restaurant scraped, so keep maxItems low.

export const maxDuration = 120; // actor runs take tens of seconds

const ACTOR = 'clearpath~resy-api';

export default async function handler(req, res) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(200).json({ ok: false, reason: 'no_key' });

  const name = String(req.query.name || '').slice(0, 80);
  if (!name) return res.status(400).json({ ok: false, reason: 'bad_params' });
  const party = Math.min(20, Math.max(1, parseInt(req.query.party, 10) || 2));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : undefined;

  try {
    const r = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=100`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: 'Paris',
          query: name,
          maxItems: 3,
          includeAvailability: true,
          partySize: party,
          ...(date ? { date } : {}),
        }),
      }
    );
    if (!r.ok) return res.status(200).json({ ok: false, reason: `apify_${r.status}` });
    const items = await r.json();
    if (!Array.isArray(items) || !items.length) {
      return res.status(200).json({ ok: true, found: false });
    }

    // Resy's Paris inventory is thin and the actor fuzzy-matches across cities;
    // only accept results actually in Paris, and prefer a real name match.
    const inParis = items.filter((i) =>
      /paris/i.test(String(i.locality || '')) || String(i.country || '').toLowerCase() === 'france'
    );
    const low = name.toLowerCase();
    const hit = inParis.find((i) => String(i.name || '').toLowerCase().includes(low)) || inParis[0];
    if (!hit) return res.status(200).json({ ok: true, found: false });

    const slots = (Array.isArray(hit.slots) ? hit.slots : [])
      .map((s) => (typeof s === 'string' ? s : (s.time || s.start || s.label || s.dateTime || null)))
      .filter(Boolean)
      .map((s) => {
        const m = String(s).match(/(\d{1,2}:\d{2})/);
        return m ? m[1] : String(s).slice(0, 12);
      })
      .slice(0, 6);

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json({
      ok: true,
      found: true,
      match: hit.name || null,
      url: hit.url || hit.canonicalUrl || null,
      slots,
      rating: hit.rating ?? null,
      cuisine: Array.isArray(hit.cuisine) ? hit.cuisine.slice(0, 2) : [],
    });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
