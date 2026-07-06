// AI scout for the deck: gpt-5.1 with web search reads the taste profile and
// hunts current, specific places in the user's city; every pick is then
// verified against Google Places (real coords, rating) before it may become a
// card — the model proposes, Google confirms existence.
// GET ?city=&ll=&taste=&d= -> { ok, places: [...] }, cached 6h at the edge.

const KINDS = ['Restaurant', 'Café', 'Wine bar', 'Bar', 'Cocktail bar', 'Bakery', 'Museum', 'Gallery', 'Vintage shop', 'Bookshop', 'Concept store', 'Market', 'Park', 'Club', 'Landmark', 'Street food'];

export default async function handler(req, res) {
  const okey = process.env.OPENAI_API_KEY;
  const gkey = process.env.GOOGLE_PLACES_API_KEY;
  if (!okey || !gkey) return res.status(200).json({ ok: false, reason: 'no_key' });

  const city = String(req.query.city || 'Paris').slice(0, 40);
  const ll = String(req.query.ll || '48.8590,2.3600');
  const taste = String(req.query.taste || '').slice(0, 400);

  try {
    const sys = `You are a sharp local scout for ${city}. Using web search, find 8 specific, currently-operating places that fit this person's taste profile. Rules: real places only, open these days (not permanently closed, not pop-ups that already ended); favor beloved-by-locals over tourist defaults; spread across at least 4 different kinds; each blurb is ONE dry, confident sentence (max 140 chars) on why it fits THEM — no emoji, no hype words like 'hidden gem'.`;
    const user = `Taste profile flags: ${taste || 'unknown — go for characterful, non-obvious picks'}. They are near ${ll}. Return the 8 picks.`;

    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${okey}` },
      body: JSON.stringify({
        model: 'gpt-5.1',
        reasoning: { effort: 'low' },
        tools: [{ type: 'web_search' }],
        input: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        max_output_tokens: 2000,
        text: {
          format: {
            type: 'json_schema', name: 'picks', strict: true,
            schema: {
              type: 'object', additionalProperties: false, required: ['picks'],
              properties: {
                picks: {
                  type: 'array',
                  items: {
                    type: 'object', additionalProperties: false,
                    required: ['name', 'kind', 'area', 'blurb'],
                    properties: {
                      name: { type: 'string' },
                      kind: { type: 'string', enum: KINDS },
                      area: { type: 'string' },
                      blurb: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      console.error('curator error', r.status, err.slice(0, 300));
      return res.status(200).json({ ok: false, reason: `openai_${r.status}` });
    }
    const data = await r.json();
    const text = data.output_text
      || (Array.isArray(data.output)
        ? data.output.filter((o) => o.type === 'message').flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('')
        : '');
    let picks = [];
    try { picks = (JSON.parse(text).picks || []).slice(0, 8); } catch (e) { /* no parse, no picks */ }

    // verification pass: Google must know the place, or it doesn't exist to us
    const [lat, lng] = ll.split(',').map(Number);
    const verified = (await Promise.all(picks.map(async (p) => {
      try {
        const s = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': gkey, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.businessStatus' },
          body: JSON.stringify({
            textQuery: `${p.name} ${city}`,
            locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 20000 } },
            pageSize: 1,
          }),
        }).then((x) => (x.ok ? x.json() : null));
        const hit = s?.places?.[0];
        if (!hit || hit.businessStatus === 'CLOSED_PERMANENTLY' || hit.location?.latitude == null) return null;
        return {
          id: `ai_${hit.id}`,
          name: hit.displayName?.text || p.name,
          kind: p.kind, area: String(p.area).slice(0, 40), blurb: String(p.blurb).slice(0, 150),
          lat: hit.location.latitude, lng: hit.location.longitude,
          rating: hit.rating != null ? hit.rating.toFixed(1) : null,
          ratings: hit.userRatingCount ?? null,
        };
      } catch (e) { return null; }
    }))).filter(Boolean);

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ ok: true, places: verified, proposed: picks.length });
  } catch (e) {
    console.error('curator error', e?.message);
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
