import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../config/db.js';
import slugify from '../utils/slugify.js';
import { requireAuth } from '../middleware/auth.js';
import { upload, validateImageContent } from '../middleware/upload.js';
import { logAdminActivity } from '../services/activityLog.js';
import { unlink } from 'node:fs/promises';

const router = Router();

async function removeUncommittedUpload(file) {
  if (file) await unlink(file.path);
}

router.get('/', async (req, res, next) => {
  try {
    const items = await query('SELECT id, name, slug, category, description, logo_url, display_order, is_active FROM brands WHERE is_active = 1 ORDER BY display_order ASC, name ASC');
    return res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/list', requireAuth, async (req, res, next) => {
  try {
    const hasPagination = ['page', 'limit', 'search'].some((key) => req.query[key] !== undefined);
    if (hasPagination) {
      const requestedPage = Number(req.query.page || 1);
      const requestedLimit = Number(req.query.limit || 20);
      const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(100, requestedLimit) : 20;
      const offset = (page - 1) * limit;
      const search = String(req.query.search || '').trim();
      const where = search ? 'WHERE name LIKE ? OR slug LIKE ? OR category LIKE ?' : '';
      const values = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
      const items = await query(
        `SELECT * FROM brands ${where} ORDER BY display_order ASC, name ASC LIMIT ? OFFSET ?`,
        [...values, limit, offset],
      );
      const count = await queryOne(`SELECT COUNT(*) AS total FROM brands ${where}`, values);
      const total = Number(count.total);
      return res.json({
        success: true,
        data: items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    const items = await query('SELECT * FROM brands ORDER BY display_order ASC, name ASC');
    return res.json({ success: true, data: items });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await queryOne('SELECT * FROM brands WHERE id = ? AND is_active = 1', [req.params.id]);
    return item ? res.json({ success: true, data: item }) : res.status(404).json({ success: false, message: 'Brand not found.' });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, upload.single('logo'), validateImageContent, [
  body('name').notEmpty().trim(),
  body('category').optional().trim(),
  body('description').optional(),
  body('display_order').optional().isInt(),
], async (req, res, next) => {
  let created = false;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await removeUncommittedUpload(req.file);
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });
    }

    const name = String(req.body.name || '').trim();
    const slug = slugify(req.body.slug || name);
    const existing = await queryOne('SELECT id, name, slug FROM brands WHERE name = ? OR slug = ?', [name, slug]);
    if (existing) {
      await removeUncommittedUpload(req.file);
      return res.status(409).json({ success: false, message: 'Brand name or slug already exists.' });
    }

    const logoUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.logo_url || null);
    const result = await query('INSERT INTO brands (name, slug, category, description, logo_url, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      name,
      slug,
      req.body.category || null,
      req.body.description || null,
      logoUrl,
      Number(req.body.display_order ?? 0),
      req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1,
    ]);
    created = true;
    await logAdminActivity(req.admin.id, 'create', 'brand', result.insertId, { name });
    return res.status(201).json({ success: true, message: 'Brand created.', id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY' && !created) {
      if (!created) await removeUncommittedUpload(req.file);
      return res.status(409).json({ success: false, message: 'Brand name or slug already exists.' });
    }
    if (!created && req.file) await removeUncommittedUpload(req.file);
    next(error);
  }
});

router.put('/:id', requireAuth, upload.single('logo'), validateImageContent, [
  body('name').optional().notEmpty().trim(),
  body('category').optional().trim(),
  body('description').optional(),
  body('display_order').optional().isInt(),
], async (req, res, next) => {
  let updated = false;
  try {
    const item = await queryOne('SELECT * FROM brands WHERE id = ?', [req.params.id]);
    if (!item) {
      await removeUncommittedUpload(req.file);
      return res.status(404).json({ success: false, message: 'Brand not found.' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await removeUncommittedUpload(req.file);
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });
    }

    const name = req.body.name ? String(req.body.name).trim() : item.name;
    const slug = req.body.slug ? slugify(req.body.slug) : item.slug;
    const duplicate = await queryOne('SELECT id FROM brands WHERE (name = ? OR slug = ?) AND id <> ?', [name, slug, req.params.id]);
    if (duplicate) {
      await removeUncommittedUpload(req.file);
      return res.status(409).json({ success: false, message: 'Brand name or slug already exists.' });
    }
    const removeLogo = req.body.remove_logo === true || req.body.remove_logo === 'true' || req.body.remove_logo === '1';
    await query('UPDATE brands SET name = ?, slug = ?, category = ?, description = ?, logo_url = ?, display_order = ?, is_active = ? WHERE id = ?', [
      name,
      slug,
      req.body.category ?? item.category,
      req.body.description ?? item.description,
      req.file ? `/uploads/${req.file.filename}` : (removeLogo ? null : (req.body.logo_url ?? item.logo_url)),
      Number(req.body.display_order ?? item.display_order),
      req.body.is_active === undefined ? item.is_active : (req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1),
      req.params.id,
    ]);
    updated = true;
    await logAdminActivity(req.admin.id, 'update', 'brand', req.params.id);
    return res.json({ success: true, message: 'Brand updated.' });
  } catch (error) {
    if (!updated && req.file) await removeUncommittedUpload(req.file);
    if (error.code === 'ER_DUP_ENTRY' && !updated) {
      return res.status(409).json({ success: false, message: 'Brand name or slug already exists.' });
    }
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM brands WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Brand not found.' });
    }
    await logAdminActivity(req.admin.id, 'delete', 'brand', req.params.id);
    return res.json({ success: true, message: 'Brand deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;
