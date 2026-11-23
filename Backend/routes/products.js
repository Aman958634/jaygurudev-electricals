import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../config/db.js';
import slugify from '../utils/slugify.js';
import { upload, validateImageContent } from '../middleware/upload.js';
import { requireAuth } from '../middleware/auth.js';
import { mergePresentationSpecifications, toFrontendProduct } from '../utils/productResponse.js';
import { logAdminActivity } from '../services/activityLog.js';

const router = Router();

const parsePagination = (req) => {
  const requestedPage = Number(req.query.page || 1);
  const requestedLimit = Number(req.query.limit || 12);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(100, requestedLimit) : 12;
  return { page, limit };
};

function parseSpecifications(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (error) {
      throw Object.assign(new Error('Specifications must be a JSON array.'), { statusCode: 400 });
    }
  }
  throw Object.assign(new Error('Specifications must be a JSON array.'), { statusCode: 400 });
}

function parseBooleanFlag(value) {
  if (value === undefined) return undefined;
  return value === true || value === 1 || ['true', '1'].includes(String(value).toLowerCase()) ? 1 : 0;
}

router.get('/', async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const brand = String(req.query.brand || '').trim();
    const featured = req.query.featured === 'true';
    const bestSelling = req.query.best_selling === 'true';
    const sort = String(req.query.sort || 'newest');

    let sql = `
      SELECT p.*, c.name AS category_name, c.slug AS category_slug, b.name AS brand_name, b.logo_url AS brand_logo_url
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.is_active = 1
    `;
    const values = [];

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.short_description LIKE ? OR p.description LIKE ? OR p.size LIKE ? OR b.name LIKE ? OR c.name LIKE ?)';
      const term = `%${search}%`;
      values.push(term, term, term, term, term, term, term);
    }

    if (category) {
      sql += ' AND (c.slug = ? OR c.name = ?)';
      values.push(category, category);
    }

    if (brand) {
      sql += ' AND (b.slug = ? OR b.name = ?)';
      values.push(brand, brand);
    }

    if (featured) {
      sql += ' AND p.is_featured = 1';
    }

    if (bestSelling) {
      sql += ' AND p.is_best_selling = 1';
    }

    const sortMap = {
      newest: 'p.display_order ASC, p.created_at DESC',
      name_asc: 'p.name ASC',
      name_desc: 'p.name DESC',
      price_asc: 'p.price ASC',
      price_desc: 'p.price DESC',
    };
    sql += ` ORDER BY ${sortMap[sort] || sortMap.newest}`;
    sql += ' LIMIT ? OFFSET ?';
    values.push(limit, offset);

    const items = await query(sql, values);
    const countSql = `SELECT COUNT(*) AS total FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN brands b ON b.id = p.brand_id WHERE p.is_active = 1`;
    const countValues = [];

    let countQuery = countSql;
    if (search) {
      countQuery += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.short_description LIKE ? OR p.description LIKE ? OR p.size LIKE ? OR b.name LIKE ? OR c.name LIKE ?)';
      const term = `%${search}%`;
      countValues.push(term, term, term, term, term, term, term);
    }
    if (category) {
      countQuery += ' AND (c.slug = ? OR c.name = ?)';
      countValues.push(category, category);
    }
    if (brand) {
      countQuery += ' AND (b.slug = ? OR b.name = ?)';
      countValues.push(brand, brand);
    }
    if (featured) {
      countQuery += ' AND p.is_featured = 1';
    }
    if (bestSelling) {
      countQuery += ' AND p.is_best_selling = 1';
    }

    const totalResult = await queryOne(countQuery, countValues);
    const total = Number(totalResult?.total || 0);

    const withImages = await Promise.all(items.map(async (product) => {
      const images = await query('SELECT id, image_path, is_primary, display_order FROM product_images WHERE product_id = ? ORDER BY display_order ASC, id ASC', [product.id]);
      const specs = await query('SELECT id, name, value FROM product_specifications WHERE product_id = ? ORDER BY name ASC', [product.id]);
      return toFrontendProduct(product, images, specs);
    }));

    return res.json({
      success: true,
      data: withImages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/list', requireAuth, async (req, res, next) => {
  try {
    const products = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug, b.name AS brand_name, b.logo_url AS brand_logo_url
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       ORDER BY p.created_at DESC`,
    );
    const data = await Promise.all(products.map(async (product) => {
      const images = await query('SELECT id, image_path, is_primary, display_order FROM product_images WHERE product_id = ? ORDER BY display_order ASC, id ASC', [product.id]);
      const specifications = await query('SELECT id, name, value FROM product_specifications WHERE product_id = ? ORDER BY name ASC', [product.id]);
      return toFrontendProduct(product, images, specifications);
    }));
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await queryOne(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug, b.name AS brand_name, b.logo_url AS brand_logo_url
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE p.id = ? AND p.is_active = 1`,
      [req.params.id],
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const images = await query('SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order ASC, id ASC', [product.id]);
    const specs = await query('SELECT * FROM product_specifications WHERE product_id = ? ORDER BY name ASC', [product.id]);

    return res.json({
      success: true,
      data: toFrontendProduct(product, images, specs),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, upload.array('images', 12), validateImageContent, [
  body('name').notEmpty().trim(),
  body('category_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('brand_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('sku').optional().trim(),
  body('price').optional({ nullable: true }).isDecimal({ decimal_digits: '2' }),
  body('stock_status').optional().isIn(['in_stock', 'out_of_stock', 'limited', 'price_on_request']),
  body('is_featured').optional().isBoolean(),
  body('is_best_selling').optional().isBoolean(),
  body('display_order').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Invalid product payload.', errors: errors.array() });
    }

    const payload = req.body;
    const name = String(payload.name || '').trim();
    const categoryId = payload.category_id ? Number(payload.category_id) : null;
    const brandId = payload.brand_id ? Number(payload.brand_id) : null;

    if (categoryId && !(await queryOne('SELECT id FROM categories WHERE id = ?', [categoryId]))) {
      return res.status(400).json({ success: false, message: 'Category not found.' });
    }
    if (brandId && !(await queryOne('SELECT id FROM brands WHERE id = ?', [brandId]))) {
      return res.status(400).json({ success: false, message: 'Brand not found.' });
    }

    const safeSku = String(payload.sku || '').trim() || `SKU-${Date.now()}`;
    const productSlug = slugify(payload.slug || name);
    const price = payload.price === '' || payload.price === null || payload.price === undefined ? null : Number(payload.price);
    const priceOnRequest = parseBooleanFlag(payload.price_on_request) ?? 0;
    const stockStatus = payload.stock_status || (priceOnRequest ? 'price_on_request' : 'in_stock');

    const existing = await queryOne('SELECT id FROM products WHERE slug = ? OR sku = ?', [productSlug, safeSku]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Product slug or SKU already exists.' });
    }

    const created = await query(
      `INSERT INTO products (
        name, slug, sku, description, short_description, category_id, brand_id, price, price_on_request,
        stock_status, is_featured, is_best_selling, display_order, is_active, badge, size, image, meta_title, meta_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        productSlug,
        safeSku,
        payload.description || null,
        payload.short_description || null,
        categoryId,
        brandId,
        price,
        priceOnRequest,
        stockStatus,
        parseBooleanFlag(payload.is_featured) ?? 0,
        parseBooleanFlag(payload.is_best_selling) ?? 0,
        Number(payload.display_order ?? 0),
        parseBooleanFlag(payload.is_active) ?? 1,
        payload.badge || null,
        payload.size || payload.size_rating || null,
        payload.image || null,
        payload.meta_title || null,
        payload.meta_description || null,
      ],
    );

    const productId = created.insertId;
    const uploadedImages = req.files || [];
    if (uploadedImages.length) {
      for (let index = 0; index < uploadedImages.length; index += 1) {
        const file = uploadedImages[index];
        await query('INSERT INTO product_images (product_id, image_path, is_primary, display_order) VALUES (?, ?, ?, ?)', [productId, `/uploads/${file.filename}`, index === 0 ? 1 : 0, index]);
      }
    } else if (payload.image) {
      await query('INSERT INTO product_images (product_id, image_path, is_primary, display_order) VALUES (?, ?, ?, ?)', [productId, payload.image, 1, 0]);
    }

    const specificationEntries = mergePresentationSpecifications(parseSpecifications(payload.specifications) || [], payload);
    for (const spec of specificationEntries) {
      if (!spec || !spec.name || !spec.value) continue;
      await query('INSERT INTO product_specifications (product_id, name, value) VALUES (?, ?, ?)', [productId, String(spec.name), String(spec.value)]);
    }

    await logAdminActivity(req.admin.id, 'create', 'product', productId, { name });
    return res.status(201).json({ success: true, message: 'Product created.', productId });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, upload.array('images', 12), validateImageContent, [
  body('name').optional().notEmpty().trim(),
  body('category_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('brand_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('price').optional({ nullable: true }).isDecimal({ decimal_digits: '2' }),
  body('stock_status').optional().isIn(['in_stock', 'out_of_stock', 'limited', 'price_on_request']),
  body('price_on_request').optional().isBoolean(),
  body('is_featured').optional().isBoolean(),
  body('is_best_selling').optional().isBoolean(),
  body('display_order').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Invalid product payload.', errors: errors.array() });
    }

    const product = await queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const payload = req.body;
    const categoryId = payload.category_id === undefined ? product.category_id : (payload.category_id ? Number(payload.category_id) : null);
    const brandId = payload.brand_id === undefined ? product.brand_id : (payload.brand_id ? Number(payload.brand_id) : null);
    if (categoryId && !(await queryOne('SELECT id FROM categories WHERE id = ?', [categoryId]))) {
      return res.status(400).json({ success: false, message: 'Category not found.' });
    }
    if (brandId && !(await queryOne('SELECT id FROM brands WHERE id = ?', [brandId]))) {
      return res.status(400).json({ success: false, message: 'Brand not found.' });
    }
    const updates = [];
    const values = [];

    const fields = {
      name: payload.name,
      slug: payload.slug || product.slug,
      sku: payload.sku,
      description: payload.description,
      short_description: payload.short_description,
      category_id: categoryId,
      brand_id: brandId,
      price: payload.price === '' || payload.price === null || payload.price === undefined ? null : payload.price,
      price_on_request: parseBooleanFlag(payload.price_on_request),
      stock_status: payload.stock_status,
      is_featured: parseBooleanFlag(payload.is_featured),
      is_best_selling: parseBooleanFlag(payload.is_best_selling),
      display_order: payload.display_order,
      is_active: parseBooleanFlag(payload.is_active),
      badge: payload.badge,
      size: payload.size ?? payload.size_rating,
      image: payload.image,
      meta_title: payload.meta_title,
      meta_description: payload.meta_description,
    };

    Object.entries(fields).forEach(([key, value]) => {
      if (value === undefined) return;
      if (key === 'slug' && value) {
        updates.push('slug = ?');
        values.push(slugify(value));
        return;
      }
      updates.push(`${key} = ?`);
      values.push(value === '' ? null : value);
    });

    if (updates.length) {
      values.push(req.params.id);
      await query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const presentationFieldNames = ['model', 'capacity', 'capacity_unit', 'size', 'rating', 'packing'];
    const hasPresentationFields = presentationFieldNames.some((field) => req.body[field] !== undefined);
    const specificationEntries = parseSpecifications(req.body.specifications);
    if (specificationEntries !== undefined || hasPresentationFields) {
      const existingSpecifications = specificationEntries === undefined
        ? await query('SELECT name, value FROM product_specifications WHERE product_id = ?', [req.params.id])
        : specificationEntries;
      const mergedSpecifications = mergePresentationSpecifications(existingSpecifications, req.body);
      await query('DELETE FROM product_specifications WHERE product_id = ?', [req.params.id]);
      for (const spec of mergedSpecifications) {
        if (!spec || !spec.name || !spec.value) continue;
        await query('INSERT INTO product_specifications (product_id, name, value) VALUES (?, ?, ?)', [req.params.id, String(spec.name), String(spec.value)]);
      }
    }

    if (req.files && req.files.length) {
      const existingImages = await query(
        'SELECT id, display_order FROM product_images WHERE product_id = ? ORDER BY display_order DESC, id DESC LIMIT 1',
        [req.params.id],
      );
      const nextOrder = existingImages.length ? Number(existingImages[0].display_order) + 1 : 0;
      for (let index = 0; index < req.files.length; index += 1) {
        const file = req.files[index];
        await query(
          'INSERT INTO product_images (product_id, image_path, is_primary, display_order) VALUES (?, ?, ?, ?)',
          [req.params.id, `/uploads/${file.filename}`, existingImages.length === 0 && index === 0 ? 1 : 0, nextOrder + index],
        );
      }
    }

    await logAdminActivity(req.admin.id, 'update', 'product', req.params.id);
    return res.json({ success: true, message: 'Product updated.' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const deleted = await query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (!deleted.affectedRows) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    await logAdminActivity(req.admin.id, 'delete', 'product', req.params.id);
    return res.json({ success: true, message: 'Product deleted.' });
  } catch (error) {
    next(error);
  }
});

router.get('/featured/list', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug, b.name AS brand_name, b.logo_url AS brand_logo_url
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE p.is_active = 1 AND p.is_featured = 1
       ORDER BY p.created_at DESC LIMIT 8`,
    );
    const data = await Promise.all(rows.map(async (product) => {
      const images = await query('SELECT id, image_path, is_primary, display_order FROM product_images WHERE product_id = ? ORDER BY display_order ASC, id ASC', [product.id]);
      const specs = await query('SELECT id, name, value FROM product_specifications WHERE product_id = ? ORDER BY name ASC', [product.id]);
      return toFrontendProduct(product, images, specs);
    }));
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
