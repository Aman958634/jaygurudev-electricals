import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAdminActivity } from '../services/activityLog.js';

const router = Router();
const businessName = 'JAY GURUDEV ELECTRIICALS';
const businessHours = 'Monday – Saturday · 8:00 AM – 8:00 PM · Sunday: CLOSED';
const businessAddress = 'Guruttech House, Deep Glass & Hardware wali gali, opp. Jilla Panchayat, Dhundhiyawadi, Palanpur, Gujarat 385001';
const canonicalSettings = { name: businessName, hours: businessHours };

function isLegacyShopAddress(address) {
  const normalized = String(address || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return !normalized
    || normalized.includes('gurutekhouselane')
    || normalized.startsWith('oppjillapanchayatpalanpur');
}

function normalizeSettingRows(rows) {
  return rows.map((row) => Object.hasOwn(canonicalSettings, row.key_name)
    ? { ...row, key_value: canonicalSettings[row.key_name] }
    : row);
}

router.get('/', async (req, res, next) => {
  try {
    const publicKeys = [
      'name', 'phone', 'phoneDigits', 'email', 'address', 'hours', 'mapsUrl',
      'socialFacebook', 'socialInstagram', 'socialYouTube', 'socialWhatsApp',
      'catalogueUrl', 'googleReviewUrl', 'googleRating', 'googleReviewCount', 'googleReviewVerified',
    ];
    const rows = await query(
      `SELECT key_name, key_value, description FROM site_settings
       WHERE key_name IN (${publicKeys.map(() => '?').join(', ')})
       ORDER BY key_name ASC`,
      publicKeys,
    );
    const normalizedRows = normalizeSettingRows(rows).map((row) => (
      row.key_name === 'address' && isLegacyShopAddress(row.key_value)
        ? { ...row, key_value: businessAddress }
        : row
    ));
    const settings = {
      ...Object.fromEntries(normalizedRows.map(({ key_name, key_value }) => [key_name, key_value])),
      ...canonicalSettings,
    };
    const business = {
      name: settings.name ?? null,
      phone: settings.phone ?? null,
      phoneDigits: settings.phoneDigits ?? null,
      email: settings.email ?? null,
      address: settings.address ?? null,
      hours: settings.hours ?? null,
      mapsUrl: settings.mapsUrl ?? null,
      socialFacebook: settings.socialFacebook ?? null,
      socialInstagram: settings.socialInstagram ?? null,
      socialYouTube: settings.socialYouTube ?? null,
      socialWhatsApp: settings.socialWhatsApp ?? null,
      catalogueUrl: settings.catalogueUrl ?? null,
      googleReviewUrl: settings.googleReviewUrl ?? null,
      googleRating: settings.googleRating ?? null,
      googleReviewCount: settings.googleReviewCount ?? null,
      googleReviewVerified: settings.googleReviewVerified ?? 'false',
    };
    return res.json({ success: true, data: normalizedRows, settings, business });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/list', requireAuth, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM site_settings ORDER BY key_name ASC');
    return res.json({ success: true, data: normalizeSettingRows(rows) });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, [
  body('key_name').notEmpty().trim(),
  body('key_value').notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });

    const result = await query(
      'INSERT INTO site_settings (key_name, key_value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE key_value = VALUES(key_value), description = VALUES(description)',
      [String(req.body.key_name).trim(), String(req.body.key_value), req.body.description || null],
    );

    await logAdminActivity(req.admin.id, 'upsert', 'site_setting', result.insertId || null, { key_name: req.body.key_name });
    return res.status(201).json({ success: true, message: 'Site setting saved.', id: result.insertId || null });
  } catch (error) {
    next(error);
  }
});

router.put('/:key_name', requireAuth, async (req, res, next) => {
  try {
    const setting = await queryOne('SELECT * FROM site_settings WHERE key_name = ?', [req.params.key_name]);
    if (!setting) return res.status(404).json({ success: false, message: 'Setting not found.' });
    await query('UPDATE site_settings SET key_value = ?, description = ? WHERE key_name = ?', [String(req.body.key_value ?? setting.key_value), req.body.description ?? setting.description, req.params.key_name]);
    await logAdminActivity(req.admin.id, 'update', 'site_setting', setting.id, { key_name: req.params.key_name });
    return res.json({ success: true, message: 'Setting updated.' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:key_name', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM site_settings WHERE key_name = ?', [req.params.key_name]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Setting not found.' });
    await logAdminActivity(req.admin.id, 'delete', 'site_setting', null, { key_name: req.params.key_name });
    return res.json({ success: true, message: 'Setting deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;
