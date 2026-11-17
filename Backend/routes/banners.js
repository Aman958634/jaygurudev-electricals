import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { upload, validateImageContent } from '../middleware/upload.js';
import { logAdminActivity } from '../services/activityLog.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const banners = await query('SELECT * FROM banners WHERE is_active = 1 ORDER BY display_order ASC, id ASC');
    return res.json({ success: true, data: banners });
  } catch (error) {
    return next(error);
  }
});

router.get('/admin/list', requireAuth, async (req, res, next) => {
  try {
    const banners = await query('SELECT * FROM banners ORDER BY display_order ASC, id ASC');
    return res.json({ success: true, data: banners });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, upload.single('image'), validateImageContent, [
  body('title').notEmpty().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });
    }

    const image = req.file ? `/uploads/${req.file.filename}` : (req.body.image || null);
    if (!image) return res.status(400).json({ success: false, message: 'A banner image is required.' });
    const result = await query(
      `INSERT INTO banners
       (title, subtitle, highlight, description, button_text, image, link_url, category, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(req.body.title).trim(),
        req.body.subtitle || null,
        req.body.highlight || null,
        req.body.description || null,
        req.body.button_text || null,
        image,
        req.body.link_url || null,
        req.body.category || null,
        Number(req.body.display_order ?? 0),
        req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1,
      ],
    );
    await logAdminActivity(req.admin.id, 'create', 'banner', result.insertId);
    return res.status(201).json({ success: true, message: 'Banner created.', id: result.insertId });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requireAuth, upload.single('image'), validateImageContent, async (req, res, next) => {
  try {
    const banner = await queryOne('SELECT * FROM banners WHERE id = ?', [req.params.id]);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found.' });
    }

    await query(
      `UPDATE banners
       SET title = ?, subtitle = ?, highlight = ?, description = ?, button_text = ?, image = ?,
           link_url = ?, category = ?, display_order = ?, is_active = ?
       WHERE id = ?`,
      [
        req.body.title ?? banner.title,
        req.body.subtitle ?? banner.subtitle,
        req.body.highlight ?? banner.highlight,
        req.body.description ?? banner.description,
        req.body.button_text ?? banner.button_text,
        req.file ? `/uploads/${req.file.filename}` : (req.body.image ?? banner.image),
        req.body.link_url ?? banner.link_url,
        req.body.category ?? banner.category,
        req.body.display_order ?? banner.display_order,
        req.body.is_active === undefined ? banner.is_active : (req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1),
        req.params.id,
      ],
    );
    await logAdminActivity(req.admin.id, 'update', 'banner', req.params.id);
    return res.json({ success: true, message: 'Banner updated.' });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM banners WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Banner not found.' });
    }
    await logAdminActivity(req.admin.id, 'delete', 'banner', req.params.id);
    return res.json({ success: true, message: 'Banner deleted.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
