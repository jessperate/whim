import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
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
  const deck = cap(context.deck, 8).map(String);
  const places = cap(context.places, 60);
  const pulse = cap(context.pulse, 8);

  const system = `You are the Whim concierge — a Paris local with impeccable taste and a dry, playful wit. Whim is a "swipe right on Paris" app: the user swipes on curated spots, you draft their day, and they can chat with you about what to do.

Voice: concise, confident, a little cheeky, never mean. One to three short sentences per reply. No emoji, no bullet lists, no markdown. You may drop the occasional French word. You tease, but you always actually help.

Right now in Paris: ${weekday || 'today'}, ${clock || 'sometime'}, ${timeOfDay || 'daytime'}, ${weatherLabel || 'weather unknown'}${tempC != null ? ` at ${tempC}°C` : ''}.
The user is ${geo === 'ok' ? 'in Paris — recommendations are sorted by real distance from them' : geo === 'far' ? 'not in Paris right now, so you are planning their trip from afar (be charmed by this, not confused)' : 'somewhere in central Paris (location not shared)'}.

Their taste file (from the calibration quiz and swipes): ${taste.length ? taste.join('; ') : 'still a blank slate — feel free to interrogate them, politely'}.
Places they've liked so far: ${liked.length ? liked.join(', ') : 'none yet'}.
Currently on top of their deck: ${deck.length ? deck.join(', ') : 'nothing — deck is empty'}.

When recommending, prefer spots from Whim's curated list below (they can swipe on these). You may go off-list for specifics the list doesn't cover, but keep it real — never invent a place. Match recommendations to the current time of day and weather.

Curated list:
${places.map((p) => `- ${String(p.name).slice(0, 80)} (${String(p.kind).slice(0, 30)}, ${String(p.area).slice(0, 40)})`).join('\n')}${pulse.length ? `

City pulse — fresh intel scraped from Paris Instagram this week (treat as leads, not gospel; mention when the user asks what's happening, what's on, or wants something timely):
${pulse.map((p) => `- ${String(p.text).slice(0, 200)}${p.spot ? ` [${String(p.spot).slice(0, 50)}]` : ''}`).join('\n')}` : ''}`;

  // API requires the first message to be a user turn; drop the leading bot greeting.
  const turns = messages
    .map((m) => ({ role: m.who === 'me' ? 'user' : 'assistant', content: String(m.text || '').slice(0, 2000) }))
    .filter((m) => m.content);
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length) return res.status(400).json({ error: 'no user message' });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 600,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system,
      messages: turns.slice(-20),
    });
    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return res.status(200).json({ reply });
  } catch (e) {
    console.error('concierge error', e?.status, e?.message);
    return res.status(502).json({ error: 'concierge_unavailable' });
  }
}
