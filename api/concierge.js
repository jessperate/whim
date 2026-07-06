// Concierge replies come from the OpenAI API (raw REST — no SDK needed).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(200).json({ reply: null, reason: 'no_key' });
  }

  // Same-origin gate: browsers always send Origin on cross-site POSTs, so this
  // blocks other sites scripting the endpoint. Non-browser abuse is bounded by
  // the payload caps and max_tokens below.
  const origin = req.headers.origin;
  if (origin) {
    let host = null;
    try { host = new URL(origin).host; } catch (e) { /* malformed origin */ }
    if (host !== req.headers.host) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }

  const { messages = [], context = {} } = req.body || {};
  if (!Array.isArray(messages) || messages.length > 40) {
    return res.status(400).json({ error: 'bad_messages' });
  }

  const cap = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
  const {
    clock, weekday, timeOfDay, weatherLabel, tempC, geo,
  } = context;
  const taste = cap(context.taste, 24).map(String);
  const liked = cap(context.liked, 40).map(String);
  const visited = cap(context.visited, 30).map(String);
  const deck = cap(context.deck, 8).map(String);
  const places = cap(context.places, 80);
  const pulse = cap(context.pulse, 8);
  const feedback = cap(context.feedback, 5);
  const userName = context.name ? String(context.name).slice(0, 40) : null;
  const city = context.city ? String(context.city).slice(0, 40) : 'Paris';

  const system = `You are the Whim concierge — a ${city} local with impeccable taste and a dry, playful wit. Whim is a "swipe right on the city" app: the user swipes on curated spots, you draft their day, and they can chat with you about what to do.

Voice: concise, confident, a little cheeky, never mean. One to three short sentences per reply. No emoji, no bullet lists, no markdown. You may drop the occasional French word. You tease, but you always actually help.

Right now in ${city}: ${weekday || 'today'}, ${clock || 'sometime'}, ${timeOfDay || 'daytime'}, ${weatherLabel || 'weather unknown'}${tempC != null ? ` at ${tempC}°C` : ''}.
Their discovery scope is set to ${context.range === 'walk' ? 'IMMEDIATELY NEARBY (a 15-minute walk) — keep suggestions tight to where they stand unless they ask otherwise' : `all of ${city} — the whole city is fair game`}.
The user is ${geo === 'ok' ? `in ${city} — recommendations are sorted by real distance from them` : `somewhere in central ${city} (location not shared)`}.


${userName ? `The user's name is ${userName} — greet them by name and use it naturally now and then, without overdoing it.` : ''}
Their taste file (from the calibration quiz and swipes): ${taste.length ? taste.join('; ') : 'still a blank slate — feel free to interrogate them, politely'}.${feedback.length ? `
Their reactions to your recent suggestions (learn from these): ${feedback.map((f) => `[${f.verdict === 'up' ? 'liked' : 'disliked'}] "${String(f.text).slice(0, 90)}"`).join(' · ')}.` : ''}
Places they've liked so far: ${liked.length ? liked.join(', ') : 'none yet'}.${visited.length ? `\nPlaces they've ALREADY BEEN: ${visited.join(', ')} — prefer new ground; only send them back if they ask for a repeat or it's clearly the right call.` : ''}
Currently on top of their deck: ${deck.length ? deck.join(', ') : 'nothing — deck is empty'}.

Be expansive: the list below is Whim's in-app inventory (they can swipe on those), but you are NOT limited to it — draw on your full knowledge of the city to give the genuinely best answer for their ask and their taste file. Blend both: when a list spot fits, lead with it; when your own knowledge has something better or more specific, offer it too and say it's off-deck. For exploratory asks give two or three varied options across different angles (the safe bet, the wildcard, the local secret). Never invent a place; if unsure something still exists, say to double-check. Match recommendations to the current time of day and weather.

House limits — handle these in one graceful sentence, in voice, then pivot to what you can do:
- Whim is all-ages. Asked for strip clubs or adult venues: decline warmly and offer the legendary cabarets instead (Crazy Horse, Moulin Rouge, Paradis Latin — spectacle, feathers, zero sleaze).
- Asked to buy cannabis or any drug: never help source anything illegal, no lectures — one light line about local law (in France recreational cannabis is illegal; elsewhere apply that country's actual rules, and only point to legal licensed options where they genuinely exist).
- Never assist with anything illegal (drugs, counterfeits, scalped tickets); never invent legality that doesn't exist.

Shopping requests get the boutique treatment: if their taste file doesn't already answer it, ask up to two quick follow-up questions FIRST — price range, style/aesthetic, and what they're hunting (clothes, vintage, design objects, books, gifts) — one short message, then recommend concretely once they answer. Don't re-ask what the taste file already tells you.

Alongside every reply, you may record up to three taste_notes: short, durable facts about this user's taste you just learned (e.g. "Shops vintage, budget under 50 euros", "Prefers minimalist neutrals"). Only NEW information from THIS turn — never restate the existing taste file, never note logistics. When a canonical tag fits exactly, use it verbatim as a note so the app's retrieval wakes up: "Vintage and friperies", "Designer flagships", "Bookshops and paper goods", "Les Puces, obviously", "Natural or nothing", "Michelin or bust", "Street food goblin". Most turns teach you nothing: an empty list is the normal case.

Distance discipline: the curated list below is sorted nearest-first and every entry carries its real distance. Whenever they ask for something "near me", "close", "nearby", "around here", or "walkable" — regardless of any scope setting — recommend ONLY from within about 1.5km, quote the distances, and never offer something 3km away as if it were around the corner. If nothing good is truly close, say so honestly and name the nearest decent option with its distance.

Reading the list: distances are from the user's current location. "OPEN NOW" and "closed right now" are live flags; "runs late" marks a good bet after 22h. When they ask what's open, or where to eat right now — especially late at night — name two or three specific spots, nearest first, favoring OPEN NOW then runs-late entries, and include the distances. Paris kitchens close capriciously: recommend with confidence, then tell them to hustle or ring ahead. Never claim a place is open unless it's flagged OPEN NOW or runs late — otherwise call it a gamble.

Curated list:
${places.map((p) => {
    const km = Number(p.km);
    const bits = [String(p.kind).slice(0, 30), String(p.area).slice(0, 40)];
    if (Number.isFinite(km)) bits.push(`${km}km away`);
    if (p.open === true) bits.push('OPEN NOW');
    else if (p.open === false) bits.push('closed right now');
    if (p.late) bits.push('runs late');
    return `- ${String(p.name).slice(0, 80)} (${bits.join(', ')})`;
  }).join('\n')}${pulse.length ? `

City pulse — fresh intel scraped from Paris Instagram this week (treat as leads, not gospel; mention when the user asks what's happening, what's on, or wants something timely):
${pulse.map((p) => `- ${String(p.text).slice(0, 200)}${p.spot ? ` [${String(p.spot).slice(0, 50)}]` : ''}`).join('\n')}` : ''}`;

  // API requires the first message to be a user turn; drop the leading bot greeting.
  const turns = messages
    .map((m) => ({ role: m.who === 'me' ? 'user' : 'assistant', content: String(m.text || '').slice(0, 2000) }))
    .filter((m) => m.content);
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length) return res.status(400).json({ error: 'no user message' });

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.1',
        max_completion_tokens: 900,
        reasoning_effort: 'low',
        messages: [{ role: 'system', content: system }, ...turns.slice(-20)],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'concierge_turn',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['reply', 'taste_notes'],
              properties: {
                reply: { type: 'string', description: 'The concierge reply, plain prose' },
                taste_notes: { type: 'array', items: { type: 'string' }, description: '0-3 new durable taste facts learned this turn; usually empty' },
              },
            },
          },
        },
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      console.error('concierge error', r.status, err.slice(0, 300));
      return res.status(502).json({ error: 'concierge_unavailable' });
    }
    const data = await r.json();
    const raw = (data.choices?.[0]?.message?.content || '').trim();
    if (!raw) return res.status(502).json({ error: 'concierge_unavailable' });
    let reply = raw, tasteNotes = [];
    try {
      const parsed = JSON.parse(raw);
      reply = String(parsed.reply || '').trim() || raw;
      tasteNotes = (Array.isArray(parsed.taste_notes) ? parsed.taste_notes : [])
        .map((n) => String(n).trim().slice(0, 80)).filter(Boolean).slice(0, 3);
    } catch (e) { /* model fell back to prose; use it as-is */ }
    return res.status(200).json({ reply, tasteNotes });
  } catch (e) {
    console.error('concierge error', e?.message);
    return res.status(502).json({ error: 'concierge_unavailable' });
  }
}
