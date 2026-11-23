import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../config/db.js';
import slugify from '../utils/slugify.js';
import { requireAuth } from '../middleware/auth.js';
import { logAdminActivity } from '../services/activityLog.js';

const router = Router();

function toPageResponse(page) {
  if (!page) return page;
  return {
    ...page,
    // Stable public aliases make the page-title/content mapping explicit while
    // retaining the existing database column names and API compatibility.
    page_title: page.title,
    content: page.description,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM pages WHERE is_active = 1 ORDER BY id ASC');
    return res.json({ success: true, data: rows.map(toPageResponse) });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/list', requireAuth, async (req, res, next) => {
  try {
    const pages = await query('SELECT * FROM pages ORDER BY id ASC');
    return res.json({ success: true, data: pages.map(toPageResponse) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:pageId/sections', async (req, res, next) => {
  try {
    const page = await queryOne('SELECT id FROM pages WHERE id = ? AND is_active = 1', [req.params.pageId]);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found.' });
    const sections = await query('SELECT * FROM page_sections WHERE page_id = ? AND is_active = 1 ORDER BY display_order ASC, id ASC', [page.id]);
    return res.json({ success: true, data: sections });
  } catch (error) {
    return next(error);
  }
});

router.post('/:pageId/sections', requireAuth, [
  body('section_key').notEmpty().trim().isLength({ max: 80 }),
  body('title').optional().trim().isLength({ max: 180 }),
  body('content').optional(),
  body('image').optional().trim(),
  body('display_order').optional().isInt({ min: 0 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });
    const page = await queryOne('SELECT id FROM pages WHERE id = ?', [req.params.pageId]);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found.' });
    const result = await query(
      'INSERT INTO page_sections (page_id, section_key, title, content, image, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        page.id,
        String(req.body.section_key).trim(),
        req.body.title || null,
        req.body.content || null,
        req.body.image || null,
        Number(req.body.display_order ?? 0),
        req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1,
      ],
    );
    await logAdminActivity(req.admin.id, 'create', 'page_section', result.insertId);
    return res.status(201).json({ success: true, message: 'Page section created.', id: result.insertId });
  } catch (error) {
    return next(error);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const page = await queryOne('SELECT * FROM pages WHERE slug = ? AND is_active = 1', [req.params.slug]);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found.' });
    const sections = await query('SELECT * FROM page_sections WHERE page_id = ? AND is_active = 1 ORDER BY display_order ASC', [page.id]);
    return res.json({ success: true, data: { ...toPageResponse(page), sections } });
  } catch (error) {
    next(error);
  }
});

router.put('/:pageId/sections/:sectionId', requireAuth, async (req, res, next) => {
  try {
    const section = await queryOne('SELECT * FROM page_sections WHERE id = ? AND page_id = ?', [req.params.sectionId, req.params.pageId]);
    if (!section) return res.status(404).json({ success: false, message: 'Page section not found.' });
    await query(
      `UPDATE page_sections
       SET section_key = ?, title = ?, content = ?, image = ?, display_order = ?, is_active = ?
       WHERE id = ? AND page_id = ?`,
      [
        req.body.section_key ?? section.section_key,
        req.body.title ?? section.title,
        req.body.content ?? section.content,
        req.body.image ?? section.image,
        req.body.display_order ?? section.display_order,
        req.body.is_active === undefined ? section.is_active : (req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1),
        req.params.sectionId,
        req.params.pageId,
      ],
    );
    await logAdminActivity(req.admin.id, 'update', 'page_section', req.params.sectionId);
    return res.json({ success: true, message: 'Page section updated.' });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:pageId/sections/:sectionId', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM page_sections WHERE id = ? AND page_id = ?', [req.params.sectionId, req.params.pageId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Page section not found.' });
    await logAdminActivity(req.admin.id, 'delete', 'page_section', req.params.sectionId);
    return res.json({ success: true, message: 'Page section deleted.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, [
  body('title').notEmpty().trim(),
  body('slug').optional().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });

    const title = String(req.body.title || '').trim();
    const slug = slugify(req.body.slug || title);
    const result = await query('INSERT INTO pages (slug, title, heading, description, is_active) VALUES (?, ?, ?, ?, ?)', [slug, title, req.body.heading || null, req.body.description || null, req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1]);
    await logAdminActivity(req.admin.id, 'create', 'page', result.insertId);
    return res.status(201).json({ success: true, message: 'Page created.', id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const page = await queryOne('SELECT * FROM pages WHERE id = ?', [req.params.id]);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found.' });
    const slug = req.body.slug ? slugify(req.body.slug) : page.slug;
    await query('UPDATE pages SET slug = ?, title = ?, heading = ?, description = ?, is_active = ? WHERE id = ?', [slug, req.body.title ?? page.title, req.body.heading ?? page.heading, req.body.description ?? page.description, req.body.is_active === undefined ? page.is_active : (req.body.is_active === false || req.body.is_active === 'false' ? 0 : 1), req.params.id]);
    await logAdminActivity(req.admin.id, 'update', 'page', req.params.id);
    return res.json({ success: true, message: 'Page updated.' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM pages WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Page not found.' });
    await logAdminActivity(req.admin.id, 'delete', 'page', req.params.id);
    return res.json({ success: true, message: 'Page deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;
