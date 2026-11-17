import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { queryOne, query } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { logAdminActivity } from '../services/activityLog.js';

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Invalid login payload.' });
    }

    const { email, password } = req.body;
    const admin = await queryOne('SELECT * FROM admins WHERE email = ? AND is_active = 1', [email]);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    await query('UPDATE admins SET last_login_at = NOW() WHERE id = ?', [admin.id]);

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(503).json({ success: false, message: 'Authentication is not configured.' });
    }

    const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
    await logAdminActivity(admin.id, 'login', 'admin', admin.id);

    return res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        role: admin.role,
        phone: admin.phone,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const admin = await queryOne('SELECT id, full_name, email, phone, role, last_login_at, created_at FROM admins WHERE id = ? AND is_active = 1', [req.admin.id]);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }
    return res.json({ success: true, admin });
  } catch (error) {
    next(error);
  }
});

router.get('/activity', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT l.*, a.full_name AS admin_name, a.email AS admin_email
       FROM admin_activity_logs l
       LEFT JOIN admins a ON a.id = l.admin_id
       ORDER BY l.created_at DESC
       LIMIT 100`,
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/change-password', requireAuth, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 12, max: 128 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Invalid password change request.', errors: errors.array() });
    }

    const admin = await queryOne('SELECT id, password_hash FROM admins WHERE id = ? AND is_active = 1', [req.admin.id]);
    if (!admin || !(await bcrypt.compare(req.body.current_password, admin.password_hash))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    if (req.body.current_password === req.body.new_password) {
      return res.status(400).json({ success: false, message: 'New password must differ from the current password.' });
    }

    const passwordHash = await bcrypt.hash(req.body.new_password, 12);
    await query('UPDATE admins SET password_hash = ? WHERE id = ?', [passwordHash, admin.id]);
    await logAdminActivity(admin.id, 'change_password', 'admin', admin.id);
    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
