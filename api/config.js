// Public client config. The Supabase anon key is designed to be public
// (row-level security guards the data); we serve it from env so the static
// app stays deployable without a build step.

export default function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300');
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
  });
}
