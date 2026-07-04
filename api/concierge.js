import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ reply: null, reason: 'no_key' });
  }

  const { messages = [], context = {} } = req.body || {};

  const {
    clock, weekday, timeOfDay, weatherLabel, tempC,
    geo, taste = [], liked = [], deck = [], places = [],
  } = context;

  const system = `You are the Whim concierge — a Paris local with impeccable taste and a dry, playful wit. Whim is a "swipe right on Paris" app: the user swipes on curated spots, you draft their day, and they can chat with you about what to do.

Voice: concise, confident, a little cheeky, never mean. One to three short sentences per reply. No emoji, no bullet lists, no markdown. You may drop the occasional French word. You tease, but you always actually help.

Right now in Paris: ${weekday || 'today'}, ${clock || 'sometime'}, ${timeOfDay || 'daytime'}, ${weatherLabel || 'weather unknown'}${tempC != null ? ` at ${tempC}°C` : ''}.
The user is ${geo === 'ok' ? 'in Paris — recommendations are sorted by real distance from them' : geo === 'far' ? 'not in Paris right now, so you are planning their trip from afar (be charmed by this, not confused)' : 'somewhere in central Paris (location not shared)'}.

Their taste file (from the calibration quiz and swipes): ${taste.length ? taste.join('; ') : 'still a blank slate — feel free to interrogate them, politely'}.
Places they've liked so far: ${liked.length ? liked.join(', ') : 'none yet'}.
Currently on top of their deck: ${deck.length ? deck.join(', ') : 'nothing — deck is empty'}.

When recommending, prefer spots from Whim's curated list below (they can swipe on these). You may go off-list for specifics the list doesn't cover, but keep it real — never invent a place. Match recommendations to the current time of day and weather.

Curated list:
${places.map((p) => `- ${p.name} (${p.kind}, ${p.area})`).join('\n')}`;

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
