import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import pool, { query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAdminActivity } from '../services/activityLog.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM enquiries ORDER BY created_at DESC');
    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const enquiry = await queryOne('SELECT * FROM enquiries WHERE id = ?', [req.params.id]);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    const items = await query('SELECT * FROM enquiry_items WHERE enquiry_id = ?', [enquiry.id]);
    return res.json({ success: true, data: { ...enquiry, items } });
  } catch (error) {
    next(error);
  }
});

router.post('/', enquiryLimiter, (req, res, next) => {
  req.body.customer_name = req.body.customer_name ?? req.body.name;
  req.body.customer_phone = req.body.customer_phone ?? req.body.phone;
  req.body.customer_city = req.body.customer_city ?? req.body.city;
  req.body.customer_shop = req.body.customer_shop ?? req.body.shop;
  next();
}, [
  body('customer_name').notEmpty().trim().isLength({ max: 120 }),
  body('customer_phone').notEmpty().trim().custom((phone) => {
    const digits = String(phone).replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13;
  }),
  body('requirement').notEmpty().trim(),
  body('enquiry_type').optional().isIn(['wholesale', 'product', 'contact', 'general']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });
    }

    const enquiryType = req.body.enquiry_type || 'product';
    const connection = await pool.getConnection();
    let enquiryId;
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        'INSERT INTO enquiries (enquiry_type, customer_name, customer_phone, customer_email, customer_city, customer_shop, requirement, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
        enquiryType,
        String(req.body.customer_name || '').trim(),
        String(req.body.customer_phone || '').trim(),
        req.body.customer_email || null,
        req.body.customer_city || null,
        req.body.customer_shop || null,
        String(req.body.requirement || '').trim(),
        'new',
        ],
      );

      enquiryId = result.insertId;
      const items = Array.isArray(req.body.items)
        ? req.body.items.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        : [];
      const requestedProductIds = [...new Set(items
        .map((item) => Number(item.product_id))
        .filter((id) => Number.isSafeInteger(id) && id > 0))];
      const existingProductIds = new Set();
      if (requestedProductIds.length) {
        const placeholders = requestedProductIds.map(() => '?').join(', ');
        const [products] = await connection.execute(
          `SELECT id FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
          requestedProductIds,
        );
        products.forEach((product) => existingProductIds.add(Number(product.id)));
      }

      for (const item of items) {
        const requestedProductId = Number(item.product_id);
        const productId = Number.isSafeInteger(requestedProductId) && existingProductIds.has(requestedProductId)
          ? requestedProductId
          : null;
        const productName = typeof item.product_name === 'string' || typeof item.product_name === 'number'
          ? String(item.product_name).trim().slice(0, 180) || null
          : null;
        const quantity = typeof item.quantity === 'string' || typeof item.quantity === 'number'
          ? String(item.quantity).trim().slice(0, 80) || null
          : null;
        const notes = typeof item.notes === 'string' || typeof item.notes === 'number'
          ? String(item.notes).trim() || null
          : null;
        await connection.execute('INSERT INTO enquiry_items (enquiry_id, product_id, product_name, quantity, notes) VALUES (?, ?, ?, ?, ?)', [
          enquiryId,
          productId,
          productName,
          quantity,
          notes,
        ]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return res.status(201).json({ success: true, message: 'Enquiry submitted.', id: enquiryId });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['new', 'contacted', 'quoted', 'closed', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid enquiry status.' });
    }

    const enquiry = await queryOne('SELECT * FROM enquiries WHERE id = ?', [req.params.id]);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found.' });

    await query('UPDATE enquiries SET status = ? WHERE id = ?', [status, req.params.id]);
    await query('INSERT INTO enquiry_status_history (enquiry_id, from_status, to_status, changed_by, notes) VALUES (?, ?, ?, ?, ?)', [
      req.params.id,
      enquiry.status,
      status,
      req.admin?.id || null,
      req.body.notes || null,
    ]);
    await logAdminActivity(req.admin.id, 'update_status', 'enquiry', req.params.id, { status });

    return res.json({ success: true, message: 'Enquiry status updated.' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const enquiry = await queryOne('SELECT id FROM enquiries WHERE id = ?', [req.params.id]);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found.' });

    await query('DELETE FROM enquiries WHERE id = ?', [req.params.id]);
    await logAdminActivity(req.admin.id, 'delete', 'enquiry', req.params.id);
    return res.json({ success: true, message: 'Enquiry deleted.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
