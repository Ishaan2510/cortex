const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Cookie-based auth used by the SSE endpoint.
 *
 * EventSource cannot send custom Authorization headers, so we read the JWT
 * from an httpOnly cookie that the login route sets alongside the Bearer
 * token. Same JWT, same secret, same expiry — different transport.
 *
 * The cookie is httpOnly (no JS access), Secure in production (HTTPS only),
 * and SameSite=None in production so the cross-origin SSE request from
 * Vercel to Render carries it.
 */
const protectCookie = (req, res, next) => {
  const token = req.cookies?.cortex_session;
  if (!token) {
    return res.status(401).json({ message: 'No session cookie' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
};

module.exports = { protect, protectCookie };