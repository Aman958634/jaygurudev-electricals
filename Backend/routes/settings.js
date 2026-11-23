import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAdminActivity } from '../services/activityLog.js';

const router = Router();
const businessAddress = 'Guruttech House, Deep Glass & Hardware wali gali, opp. Jilla Panchayat, Dhundhiyawadi, Palanpur, Gujarat 385001';
const urlKeys = new Set([
  'socialFacebook', 'socialInstagram', 'socialYouTube', 'socialLinkedIn', 'socialWhatsApp',
  'catalogueUrl', 'googleReviewUrl', 'googleBusinessUrl', 'mapsUrl', 'mapsDirectionsUrl', 'mapsSearchUrl', 'mapsEmbedUrl',
]);
const coordinateKeys = new Set(['latitude', 'longitude']);
const phoneKeys = new Set(['phone', 'secondaryPhone', 'phoneDigits']);

function isLegacyShopAddress(address) {
  const normalized = String(address || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return !normalized || normalized.includes('gurutekhouselane') || normalized.startsWith('oppjillapanchayatpalanpur');
}

function settingValidationError(key, value) {
  const normalized = String(value ?? '').trim();
  if (phoneKeys.has(key) && normalized && !/^\+?[0-9\s()-]{7,20}$/.test(normalized)) return 'Enter a valid phone or WhatsApp number.';
  if (key === 'email' && normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return 'Enter a valid business email address.';
  if (urlKeys.has(key) && normalized) {
    try {
      const url = new URL(normalized);
      if (!['http:', 'https:'].includes(url.protocol)) return 'URLs must use http or https.';
    } catch {
      return 'Enter a valid URL.';
    }
  }
  if (coordinateKeys.has(key) && normalized && !Number.isFinite(Number(normalized))) return 'Coordinates must be valid numbers.';
  if (key === 'latitude' && normalized && (Number(normalized) < -90 || Number(normalized) > 90)) return 'Latitude must be between -90 and 90.';
  if (key === 'longitude' && normalized && (Number(normalized) < -180 || Number(normalized) > 180)) return 'Longitude must be between -180 and 180.';
  if (key === 'businessHours' && normalized) {
    try {
      const schedule = JSON.parse(normalized);
      if (!Array.isArray(schedule) || schedule.length !== 7) return 'Business hours must contain all seven days.';
    } catch {
      return 'Business hours must be valid schedule data.';
    }
  }
  return null;
}

function toBusiness(rows) {
  const settings = Object.fromEntries(rows.map(({ key_name, key_value }) => [key_name, key_value]));
  if (isLegacyShopAddress(settings.address)) settings.address = businessAddress;
  return {
    ...settings,
    address: settings.address ?? null,
    name: settings.name ?? null,
    phone: settings.phone ?? null,
    phoneDigits: settings.phoneDigits ?? null,
    email: settings.email ?? null,
    tagline: settings.tagline ?? null,
    footerDescription: settings.footerDescription ?? null,
    footerNote: settings.footerNote ?? null,
    secondaryPhone: settings.secondaryPhone ?? null,
    city: settings.city ?? null,
    state: settings.state ?? null,
    pinCode: settings.pinCode ?? null,
    hours: settings.hours ?? null,
    businessHours: settings.businessHours ?? null,
    mapsUrl: settings.mapsUrl ?? null,
    mapsDirectionsUrl: settings.mapsDirectionsUrl ?? null,
    mapsSearchUrl: settings.mapsSearchUrl ?? null,
    mapsEmbedUrl: settings.mapsEmbedUrl ?? null,
    latitude: settings.latitude ?? null,
    longitude: settings.longitude ?? null,
    socialFacebook: settings.socialFacebook ?? null,
    socialInstagram: settings.socialInstagram ?? null,
    socialYouTube: settings.socialYouTube ?? null,
    socialLinkedIn: settings.socialLinkedIn ?? null,
    socialWhatsApp: settings.socialWhatsApp ?? null,
    catalogueUrl: settings.catalogueUrl ?? null,
    googleReviewUrl: settings.googleReviewUrl ?? null,
    googleBusinessUrl: settings.googleBusinessUrl ?? null,
    googleRating: settings.googleRating ?? null,
    googleReviewCount: settings.googleReviewCount ?? null,
    googleReviewVerified: settings.googleReviewVerified ?? 'false',
  };
}

const publicKeys = [
  'name', 'tagline', 'footerDescription', 'footerNote', 'phone', 'secondaryPhone', 'phoneDigits', 'email', 'address', 'city', 'state', 'pinCode', 'hours', 'businessHours',
  'mapsUrl', 'mapsDirectionsUrl', 'mapsSearchUrl', 'mapsEmbedUrl', 'latitude', 'longitude',
  'socialFacebook', 'socialInstagram', 'socialYouTube', 'socialLinkedIn', 'socialWhatsApp',
  'catalogueUrl', 'googleReviewUrl', 'googleBusinessUrl', 'googleRating', 'googleReviewCount', 'googleReviewVerified',
];

router.get('/', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT key_name, key_value, description FROM site_settings
       WHERE key_name IN (${publicKeys.map(() => '?').join(', ')}) ORDER BY key_name ASC`,
      publicKeys,
    );
    return res.json({ success: true, data: rows, settings: Object.fromEntries(rows.map(({ key_name, key_value }) => [key_name, key_value])), business: toBusiness(rows) });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/list', requireAuth, async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM site_settings ORDER BY key_name ASC');
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, [body('key_name').notEmpty().trim(), body('key_value').exists()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });
    const key = String(req.body.key_name).trim();
    const value = String(req.body.key_value ?? '');
    const validationError = settingValidationError(key, value);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const result = await query(
      'INSERT INTO site_settings (key_name, key_value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE key_value = VALUES(key_value), description = VALUES(description)',
      [key, value, req.body.description || null],
    );
    await logAdminActivity(req.admin.id, 'upsert', 'site_setting', result.insertId || null, { key_name: key });
    return res.status(201).json({ success: true, message: 'Site setting saved.', id: result.insertId || null });
  } catch (error) {
    next(error);
  }
});

router.put('/:key_name', requireAuth, async (req, res, next) => {
  try {
    const setting = await queryOne('SELECT * FROM site_settings WHERE key_name = ?', [req.params.key_name]);
    if (!setting) return res.status(404).json({ success: false, message: 'Setting not found.' });
    const value = String(req.body.key_value ?? setting.key_value);
    const validationError = settingValidationError(req.params.key_name, value);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    await query('UPDATE site_settings SET key_value = ?, description = ? WHERE key_name = ?', [value, req.body.description ?? setting.description, req.params.key_name]);
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
