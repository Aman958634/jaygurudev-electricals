import jwt from 'jsonwebtoken';
import { queryOne } from '../config/db.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, message: 'Authentication is not configured.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
  if (!decoded || typeof decoded !== 'object' || !Number.isInteger(decoded.id)) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }

  try {
    const admin = await queryOne('SELECT id, email, role FROM admins WHERE id = ? AND is_active = 1', [decoded.id]);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin account is inactive or unavailable.' });
    }

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
