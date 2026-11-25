import jwt from 'jsonwebtoken';
import { queryOne } from '../config/db.js';

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function resolveAuthenticatedAdmin(req) {
  if (req.adminAuthentication) return req.adminAuthentication;

  req.adminAuthentication = (async () => {
    const token = bearerToken(req);
    if (!token) return { error: { status: 401, message: 'Authentication required.' } };

    const secret = process.env.JWT_SECRET;
    if (!secret) return { error: { status: 503, message: 'Authentication is not configured.' } };

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      return { error: { status: 401, message: 'Invalid or expired token.' } };
    }
    if (!decoded || typeof decoded !== 'object' || !Number.isInteger(decoded.id)) {
      return { error: { status: 401, message: 'Invalid or expired token.' } };
    }

    const admin = await queryOne('SELECT id, email, role FROM admins WHERE id = ? AND is_active = 1', [decoded.id]);
    if (!admin) return { error: { status: 401, message: 'Admin account is inactive or unavailable.' } };
    req.admin = admin;
    return { admin };
  })();
  return req.adminAuthentication;
}

// This never grants access itself. It only identifies an active database-backed
// administrator so the public limiter can skip a request after verification.
export async function identifyAuthenticatedAdmin(req, res, next) {
  if (!bearerToken(req)) return next();
  try {
    await resolveAuthenticatedAdmin(req);
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function requireAuth(req, res, next) {
  if (!bearerToken(req)) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  try {
    const { admin, error } = await resolveAuthenticatedAdmin(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });
    req.admin = admin;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
    }
    return next();
  };
}
