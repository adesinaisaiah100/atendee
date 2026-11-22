/**
 * Vercel Serverless Proxy: POST /api/wcf-sync
 *
 * Keeps WCF_SYNC_API_KEY strictly server-side, avoids browser CORS issues,
 * verifies the caller's Supabase Auth JWT, and enforces that ONLY the WCF
 * fellowship can forward absentees to wcf-track.vercel.app.
 */

interface IncomingRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}

interface OutgoingResponse {
  status: (code: number) => OutgoingResponse;
  json: (payload: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const ALLOWED_EVENTS = new Set([
  'prayer_meeting',
  'fjc',
  'bible_study',
  'sunday_service',
]);

const DEFAULT_TRACKER_URL = 'https://wcf-track.vercel.app/api/v1/sync/attendance';
const DEFAULT_SUPABASE_URL = 'https://osbwakzvzyrpoarbvezi.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zYndha3p2enlycG9hcmJ2ZXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MTU2NjMsImV4cCI6MjEwMjQ5MTY2M30.Mp73xw3eg7sSrzX-tkC7Uw5pTLU30I6ABzddnvLTXXY';

function getHeader(req: IncomingRequest, name: string): string {
  const val = req.headers[name] ?? req.headers[name.toLowerCase()];
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
}

function isAllowedWcfTenant(input: {
  id?: string;
  slug?: string;
  name?: string;
}): boolean {
  const envId = process.env.WCF_FELLOWSHIP_ID?.trim();
  if (envId) {
    return Boolean(input.id && input.id === envId);
  }

  const envSlug = process.env.WCF_FELLOWSHIP_SLUG?.trim().toLowerCase();
  if (envSlug) {
    return Boolean(input.slug && input.slug.trim().toLowerCase() === envSlug);
  }

  const slug = (input.slug || '').trim().toLowerCase();
  const name = (input.name || '').trim().toLowerCase();

  return (
    slug === 'wcf' ||
    slug.startsWith('wcf-') ||
    slug.endsWith('-wcf') ||
    slug.includes('-wcf-') ||
    /\bwcf\b/.test(name) ||
    name.includes('winners campus fellowship')
  );
}

export default async function handler(req: IncomingRequest, res: OutgoingResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const apiKey = process.env.WCF_SYNC_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      error: 'WCF_SYNC_API_KEY is not configured in Vercel environment variables.',
    });
  }

  // 1. Verify caller's Supabase JWT so unauthenticated callers cannot abuse the proxy
  const authHeader = getHeader(req, 'authorization');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({
      ok: false,
      error: 'Missing admin session token. Please sign in again.',
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;

  let verifiedFellowshipId: string | undefined;
  let verifiedFellowshipName: string | undefined;

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid or expired admin session. Please sign in again.',
      });
    }

    const userData = (await userRes.json()) as {
      id?: string;
      user_metadata?: { fellowship_id?: string; fellowship_name?: string };
    };
    verifiedFellowshipId = userData?.user_metadata?.fellowship_id;
    verifiedFellowshipName = userData?.user_metadata?.fellowship_name;
  } catch {
    return res.status(502).json({
      ok: false,
      error: 'Could not verify admin session with Supabase.',
    });
  }

  // 2. Parse & validate request body
  let body: any = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: 'Malformed JSON payload.' });
    }
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Request body is required.' });
  }

  const {
    fellowshipId,
    fellowshipSlug,
    fellowshipName,
    event,
    sessionDate,
    absentees,
  } = body;

  // Prevent tenant spoofing if user_metadata carries a fellowship_id
  if (verifiedFellowshipId && fellowshipId && verifiedFellowshipId !== fellowshipId) {
    return res.status(403).json({
      ok: false,
      error: 'Fellowship mismatch for authenticated admin.',
    });
  }

  // 3. Enforce strict WCF-only tenant gate
  if (
    !isAllowedWcfTenant({
      id: verifiedFellowshipId || fellowshipId,
      slug: fellowshipSlug,
      name: verifiedFellowshipName || fellowshipName,
    })
  ) {
    return res.status(403).json({
      ok: false,
      error: 'WCF Attendance Sync is restricted strictly to the WCF fellowship.',
    });
  }

  if (typeof event !== 'string' || !ALLOWED_EVENTS.has(event)) {
    return res.status(422).json({
      ok: false,
      error: `Invalid event name "${String(event)}". Must be one of: prayer_meeting, fjc, bible_study, sunday_service.`,
    });
  }

  if (typeof sessionDate !== 'string' || !sessionDate.trim()) {
    return res.status(422).json({ ok: false, error: 'sessionDate is required.' });
  }

  if (!Array.isArray(absentees) || absentees.length === 0) {
    return res.status(422).json({
      ok: false,
      error: 'At least one absentee member is required.',
    });
  }

  // 4. Forward to WCF Evangelism & Follow-up Tracker API
  const trackerUrl = process.env.WCF_TRACKER_URL?.trim() || DEFAULT_TRACKER_URL;

  try {
    const upstream = await fetch(trackerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ event, sessionDate, absentees }),
    });

    const upstreamData = await upstream.json().catch(() => ({
      error: `Upstream returned HTTP ${upstream.status}`,
    }));

    return res.status(upstream.status).json(upstreamData);
  } catch (err: any) {
    return res.status(502).json({
      ok: false,
      error: err?.message || 'Failed to reach WCF Follow-up Tracker API.',
    });
  }
}
