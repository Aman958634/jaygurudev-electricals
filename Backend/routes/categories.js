import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../config/db.js';
import slugify from '../utils/slugify.js';
import { requireAuth } from '../middleware/auth.js';
import { upload, validateImageContent } from '../middleware/upload.js';
import { logAdminActivity } from '../services/activityLog.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const items = await query('SELECT * FROM categories WHERE is_active = 1 ORDER BY display_order ASC, name ASC');
    return res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/list', requireAuth, async (req, res, next) => {
  try {
    const items = await query('SELECT * FROM categories ORDER BY display_order ASC, name ASC');
    return res.json({ success: true, data: items });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await queryOne('SELECT * FROM categories WHERE id = ? AND is_active = 1', [req.params.id]);
    return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Category not found.' });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, upload.single('image'), validateImageContent, [
  body('name').notEmpty().trim(),
  body('subtitle').optional().trim(),
  body('icon').optional().trim(),
  body('image').optional().trim(),
  body('display_order').optional().isInt({ min: 0 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });
    }

    const name = String(req.body.name || '').trim();
    const slug = slugify(req.body.slug || name);
    const payload = {
      name,
      slug,
      subtitle: req.body.subtitle || null,
      description: req.body.description || null,
      image: req.file ? `/uploads/${req.file.filename}` : (req.body.image || null),
      icon: req.body.icon || null,
      display_order: Number(req.body.display_order ?? 0),
      is_active: req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1,
    };

    const existing = await queryOne('SELECT id FROM categories WHERE slug = ?', [slug]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Category slug already exists.' });
    }

    const result = await query('INSERT INTO categories (name, slug, subtitle, description, image, icon, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [payload.name, payload.slug, payload.subtitle, payload.description, payload.image, payload.icon, payload.display_order, payload.is_active]);
    await logAdminActivity(req.admin.id, 'create', 'category', result.insertId, { name });
    return res.status(201).json({ success: true, message: 'Category created.', id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, upload.single('image'), validateImageContent, [
  body('name').optional().notEmpty().trim(),
  body('subtitle').optional().trim(),
  body('description').optional(),
  body('icon').optional().trim(),
  body('image').optional().trim(),
  body('display_order').optional().isInt({ min: 0 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });
    }

    const item = await queryOne('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    const name = req.body.name ? String(req.body.name).trim() : item.name;
    const slug = req.body.slug ? slugify(req.body.slug) : item.slug;
    await query('UPDATE categories SET name = ?, slug = ?, subtitle = ?, description = ?, image = ?, icon = ?, display_order = ?, is_active = ? WHERE id = ?', [
      name,
      slug,
      req.body.subtitle ?? item.subtitle,
      req.body.description ?? item.description,
      req.file ? `/uploads/${req.file.filename}` : (req.body.image ?? item.image),
      req.body.icon ?? item.icon,
      req.body.display_order ?? item.display_order,
      req.body.is_active === undefined ? item.is_active : (req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1),
      req.params.id,
    ]);

    await logAdminActivity(req.admin.id, 'update', 'category', req.params.id);
    return res.json({ success: true, message: 'Category updated.' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    await logAdminActivity(req.admin.id, 'delete', 'category', req.params.id);
    return res.json({ success: true, message: 'Category deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;
