// Reddit chatter — social proof for a venue from the Paris subreddits.
// GET ?q=<venue name> -> up to 3 threads mentioning it. Public JSON API, no key.

export default async function handler(req, res) {
  const q = String(req.query.q || '').slice(0, 80).trim();
  if (!q) return res.status(400).json({ ok: false, reason: 'bad_params' });

  const url = new URL('https://www.reddit.com/r/paris+ParisTravelGuide+AskParis/search.json');
  url.searchParams.set('q', `"${q}"`);
  url.searchParams.set('restrict_sr', '1');
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('t', 'all');
  url.searchParams.set('limit', '8');

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'whim-paris-concierge/1.0 (personal prototype)' },
    });
    if (!r.ok) return res.status(200).json({ ok: false, reason: `reddit_${r.status}` });
    const j = await r.json();

    const threads = (j?.data?.children || [])
      .map((c) => c.data)
      .filter((d) => d && d.title)
      .map((d) => ({
        title: String(d.title).slice(0, 120),
        ups: d.ups ?? 0,
        sub: d.subreddit || '',
        url: `https://www.reddit.com${d.permalink}`,
      }))
      .sort((a, b) => b.ups - a.ups)
      .slice(0, 3);

    // Chatter moves slowly; cache a week.
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=1209600');
    return res.status(200).json({ ok: true, threads });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
