import crypto from 'crypto';

const SECRET = process.env.ADMIN_TOKEN_SECRET;
const TTL_MS = 8 * 60 * 60 * 1000; // 8 h

export function generateToken() {
  const now     = Date.now();
  const payload = { iat: now, exp: now + TTL_MS };
  const b64     = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig     = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;

  const b64 = token.slice(0, dot);
  const sig  = token.slice(dot + 1);

  const expected = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
  const sigBuf   = Buffer.from(sig, 'base64url');
  const expBuf   = Buffer.from(expected, 'base64url');

  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload.exp < Date.now()) return null;
  return payload;
}

// Returns true if authorized, false + sends 401 if not.
export function requireAuth(req, res) {
  const auth  = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
