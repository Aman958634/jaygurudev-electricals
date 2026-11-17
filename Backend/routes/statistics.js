import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAdminActivity } from '../services/activityLog.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const data = await query('SELECT metric_key, metric_value, label, display_order FROM business_statistics WHERE is_active = 1 ORDER BY display_order ASC, id ASC');
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

router.get('/admin/list', requireAuth, async (req, res, next) => {
  try {
    const data = await query('SELECT * FROM business_statistics ORDER BY display_order ASC, id ASC');
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, [
  body('metric_key').notEmpty().trim().isLength({ max: 80 }),
  body('metric_value').notEmpty().trim().isLength({ max: 120 }),
  body('label').optional().trim().isLength({ max: 180 }),
  body('display_order').optional().isInt({ min: 0 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });
    }

    const result = await query(
      'INSERT INTO business_statistics (metric_key, metric_value, label, display_order, is_active) VALUES (?, ?, ?, ?, ?)',
      [
        String(req.body.metric_key).trim(),
        String(req.body.metric_value).trim(),
        req.body.label || null,
        Number(req.body.display_order ?? 0),
        req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1,
      ],
    );
    await logAdminActivity(req.admin.id, 'create', 'business_statistic', result.insertId);
    return res.status(201).json({ success: true, message: 'Business statistic created.', id: result.insertId });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const statistic = await queryOne('SELECT * FROM business_statistics WHERE id = ?', [req.params.id]);
    if (!statistic) {
      return res.status(404).json({ success: false, message: 'Business statistic not found.' });
    }
    await query(
      `UPDATE business_statistics
       SET metric_key = ?, metric_value = ?, label = ?, display_order = ?, is_active = ?
       WHERE id = ?`,
      [
        req.body.metric_key ?? statistic.metric_key,
        req.body.metric_value ?? statistic.metric_value,
        req.body.label ?? statistic.label,
        req.body.display_order ?? statistic.display_order,
        req.body.is_active === undefined ? statistic.is_active : (req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1),
        req.params.id,
      ],
    );
    await logAdminActivity(req.admin.id, 'update', 'business_statistic', req.params.id);
    return res.json({ success: true, message: 'Business statistic updated.' });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM business_statistics WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Business statistic not found.' });
    }
    await logAdminActivity(req.admin.id, 'delete', 'business_statistic', req.params.id);
    return res.json({ success: true, message: 'Business statistic deleted.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
