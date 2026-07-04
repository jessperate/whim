// Reddit chatter — social proof for a venue from the Paris subreddits.
// GET ?q=<venue name> -> up to 3 threads mentioning it. Public JSON API, no key.

export default async function handler(req, res) {
  const q = String(req.query.q || '').slice(0, 80).trim();
  if (!q) return res.status(400).json({ ok: false, reason: 'bad_params' });

  // reddit.com's JSON API now 403s server traffic; pullpush.io mirrors it openly
  const url = new URL('https://api.pullpush.io/reddit/search/submission/');
  url.searchParams.set('q', q);
  url.searchParams.set('subreddit', 'paris,ParisTravelGuide,AskParis,francetravel');
  url.searchParams.set('size', '10');

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'whim-paris-concierge/1.0 (personal prototype)' },
    });
    if (!r.ok) return res.status(200).json({ ok: false, reason: `reddit_${r.status}` });
    const j = await r.json();

    const low = q.toLowerCase();
    const threads = (j?.data || [])
      .filter((d) => d && d.title)
      .map((d) => ({
        title: String(d.title).slice(0, 120),
        ups: d.score ?? 0,
        sub: d.subreddit || '',
        url: d.permalink ? `https://www.reddit.com${d.permalink}` : (d.full_link || '#'),
        hit: (String(d.title) + ' ' + String(d.selftext || '')).toLowerCase().includes(low),
      }))
      .sort((a, b) => (b.hit - a.hit) || (b.ups - a.ups))
      .slice(0, 3)
      .map(({ hit, ...t }) => t);

    // Chatter moves slowly; cache a week.
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=1209600');
    return res.status(200).json({ ok: true, threads });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
