import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { upload, validateImageContent } from '../middleware/upload.js';
import { logAdminActivity } from '../services/activityLog.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const items = await query('SELECT * FROM gallery WHERE is_active = 1 ORDER BY display_order ASC, id ASC');
    return res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/list', requireAuth, async (req, res, next) => {
  try {
    const items = await query('SELECT * FROM gallery ORDER BY display_order ASC, id ASC');
    return res.json({ success: true, data: items });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, upload.single('image'), validateImageContent, [
  body('title').notEmpty().trim(),
  body('image').optional().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });
    }
    const image = req.file ? `/uploads/${req.file.filename}` : String(req.body.image || '').trim();
    if (!image) return res.status(400).json({ success: false, message: 'An image upload or image path is required.' });

    const result = await query('INSERT INTO gallery (title, category, image, display_order, is_active) VALUES (?, ?, ?, ?, ?)', [
      String(req.body.title || '').trim(),
      req.body.category || null,
      image,
      Number(req.body.display_order ?? 0),
      req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1,
    ]);

    await logAdminActivity(req.admin.id, 'create', 'gallery', result.insertId);
    return res.status(201).json({ success: true, message: 'Gallery item added.', id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, upload.single('image'), validateImageContent, async (req, res, next) => {
  try {
    const item = await queryOne('SELECT * FROM gallery WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ success: false, message: 'Gallery item not found.' });

    await query('UPDATE gallery SET title = ?, category = ?, image = ?, display_order = ?, is_active = ? WHERE id = ?', [
      req.body.title ?? item.title,
      req.body.category ?? item.category,
      req.file ? `/uploads/${req.file.filename}` : (req.body.image ?? item.image),
      req.body.display_order ?? item.display_order,
      req.body.is_active === undefined ? item.is_active : (req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1),
      req.params.id,
    ]);

    await logAdminActivity(req.admin.id, 'update', 'gallery', req.params.id);
    return res.json({ success: true, message: 'Gallery item updated.' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM gallery WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Gallery item not found.' });
    await logAdminActivity(req.admin.id, 'delete', 'gallery', req.params.id);
    return res.json({ success: true, message: 'Gallery item deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;
