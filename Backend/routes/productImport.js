import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import yauzl from 'yauzl';
import yazl from 'yazl';
import path from 'node:path';
import fs from 'node:fs';
import { mkdir, readFile, writeFile, copyFile, unlink, rm, readdir, stat, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../middleware/auth.js';
import pool, { query } from '../config/db.js';
import slugify from '../utils/slugify.js';
import { mergePresentationSpecifications } from '../utils/productResponse.js';
import { hasProductDisplayOrder } from '../utils/productSchema.js';
import { productInsertValues } from '../utils/productOrdering.js';
import { uploadsDir } from '../middleware/upload.js';
import { logAdminActivity } from '../services/activityLog.js';
import { extractPdfCatalogue } from '../services/pdfCatalogue.js';

const router = Router();
const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateImportRoot = path.resolve(process.env.IMPORT_STORAGE_ROOT || path.join(backendDirectory, 'private-imports'));
const extractionCacheRoot = path.join(privateImportRoot, 'pdf-cache');
// Bump whenever extraction semantics change so an older OCR result can never
// be silently reused with newer row reconstruction rules.
export const PDF_PARSER_VERSION = 'trivo-table-v42';
const PDF_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
function configuredMegabytes(name, fallback, maximum) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 && value <= maximum ? value : fallback;
}
// Keep the established 50 MiB ceiling by default.  The environment option is
// intentionally bounded so a deployment typo cannot turn this endpoint into
// an unbounded disk-consumption path.
const MAX_ZIP_BYTES = configuredMegabytes('IMPORT_MAX_ZIP_MB', 50, 250) * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 200 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 5000;
const BATCH_SIZE = Math.max(10, Math.min(50, Number(process.env.IMPORT_BATCH_SIZE || 25)));
const activeJobs = new Set();
const activePdfHashes = new Map();
const IMAGE_EXTENSIONS = new Map([['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'], ['.webp', 'image/webp']]);
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/r9sAAAAASUVORK5CYII=', 'base64');

await mkdir(privateImportRoot, { recursive: true });
await mkdir(extractionCacheRoot, { recursive: true });

function pdfCachePath(hash) { return path.join(extractionCacheRoot, `${hash}-${PDF_PARSER_VERSION}.json`); }
async function readPdfCache(hash) {
  try {
    const cached = JSON.parse(await readFile(pdfCachePath(hash), 'utf8'));
    if (cached.parserVersion !== PDF_PARSER_VERSION || !cached.extraction) return null;
    return { ...cached.extraction, images: cached.extraction.images.map((image) => ({ ...image, buffer: Buffer.from(image.buffer, 'base64') })) };
  } catch { return null; }
}
async function writePdfCache(hash, extraction) {
  const cache = { parserVersion: PDF_PARSER_VERSION, createdAt: new Date().toISOString(), extraction: { ...extraction, images: extraction.images.map(({ buffer, ...image }) => ({ ...image, buffer: buffer.toString('base64') })) } };
  await atomicJsonWrite(pdfCachePath(hash), cache);
}
async function cleanupPdfCache() {
  const now = Date.now();
  const entries = await readdir(extractionCacheRoot).catch(() => []);
  await Promise.all(entries.filter((entry) => entry.endsWith('.json')).map(async (entry) => {
    const file = path.join(extractionCacheRoot, entry); const details = await stat(file).catch(() => null);
    if (details && now - details.mtimeMs > PDF_CACHE_MAX_AGE_MS) await unlink(file).catch(() => {});
  }));
}

const importUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, privateImportRoot),
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_ZIP_BYTES, files: 14, fields: 20, parts: 34 },
});

function normalize(value) { return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase(); }
function safeCell(value) { return String(value ?? '').trim(); }
function safeCsv(value) { const text = String(value ?? ''); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function imageMime(filename) { return IMAGE_EXTENSIONS.get(path.extname(filename).toLowerCase()) || null; }
function validImage(bytes, mime) {
  return (mime === 'image/png' && bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    || (mime === 'image/jpeg' && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    || (mime === 'image/webp' && bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
}
function jobDirectory(id) { return path.join(privateImportRoot, id); }
function manifestPath(id) { return path.join(jobDirectory(id), 'job.json'); }
function thumbnailPath(id, imageId) { return path.join(jobDirectory(id), 'images', imageId); }
async function atomicJsonWrite(destination, value) {
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const previous = `${destination}.${randomUUID()}.previous`;
  let movedPrevious = false;
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
    // Windows rename cannot overwrite an existing destination. Move the old
    // complete file aside, then promote the complete temporary file. Readers
    // retry briefly in the tiny swap window (see loadJob below), rather than
    // parsing an in-place partially-written manifest.
    try { await rename(destination, previous); movedPrevious = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(temporary, destination);
    if (movedPrevious) await unlink(previous).catch(() => {});
  } catch (error) {
    await unlink(temporary).catch(() => {});
    if (movedPrevious) {
      await rename(previous, destination).catch(() => {});
    }
    throw error;
  }
}
async function saveJob(job) { job.updatedAt = new Date().toISOString(); await atomicJsonWrite(manifestPath(job.id), job); }
async function readCompleteJob(id) {
  let lastError;
  // A status request can arrive between the two Windows rename operations.
  // Never turn that harmless millisecond race into a 404/stale-UI reset.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try { return JSON.parse(await readFile(manifestPath(id), 'utf8')); } catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, 20)); }
  }
  throw lastError;
}
async function loadJob(id, adminId) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw Object.assign(new Error('Import job not found.'), { statusCode: 404 });
  let job;
  try { job = await readCompleteJob(id); } catch { throw Object.assign(new Error('Import job not found.'), { statusCode: 404 }); }
  if (Number(job.ownerAdminId) !== Number(adminId)) throw Object.assign(new Error('Import job not found.'), { statusCode: 404 });
  return job;
}
function rejectUnsafeZipEntry(entry) {
  const name = String(entry.fileName || '').replaceAll('\\', '/');
  const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
  if (!name || name.includes('\0') || name.startsWith('/') || name.split('/').includes('..') || mode === 0o120000) {
    throw Object.assign(new Error('ZIP contains an unsafe path or link.'), { statusCode: 400 });
  }
  return name;
}
function openZip(filePath) { return new Promise((resolve, reject) => yauzl.open(filePath, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => error ? reject(error) : resolve(zip))); }
function zipStream(zip, entry) { return new Promise((resolve, reject) => zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream))); }

async function extractBundle(bundlePath, directory, { requireSpreadsheet = true } = {}) {
  const zip = await openZip(bundlePath);
  const imagesDirectory = path.join(directory, 'images');
  await mkdir(imagesDirectory, { recursive: true });
  const images = [];
  let spreadsheet = null;
  let entries = 0;
  let extractedBytes = 0;
  return new Promise((resolve, reject) => {
    const fail = (error) => { zip.close(); reject(error); };
    zip.on('error', fail);
    zip.on('entry', async (entry) => {
      try {
        entries += 1;
        if (entries > MAX_ZIP_ENTRIES) throw Object.assign(new Error('ZIP contains too many files.'), { statusCode: 400 });
        const name = rejectUnsafeZipEntry(entry);
        if (/\/$/.test(name)) { zip.readEntry(); return; }
        extractedBytes += Number(entry.uncompressedSize || 0);
        if (extractedBytes > MAX_EXTRACTED_BYTES || Number(entry.uncompressedSize || 0) > MAX_IMAGE_BYTES) throw Object.assign(new Error('ZIP exceeds the allowed extracted size.'), { statusCode: 400 });
        const basename = path.posix.basename(name);
        const lowerBase = basename.toLowerCase();
        const stream = await zipStream(zip, entry);
        if ((lowerBase === 'products.xlsx' || lowerBase === 'products.csv') && !spreadsheet) {
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          spreadsheet = { name: lowerBase, buffer: Buffer.concat(chunks) };
        } else if (name.toLowerCase().startsWith('images/') && imageMime(basename)) {
          const imageId = `${randomUUID()}${path.extname(basename).toLowerCase()}`;
          const target = path.join(imagesDirectory, imageId);
          await pipeline(stream, createWriteStream(target, { flags: 'wx' }));
          const head = (await readFile(target)).subarray(0, 12);
          const mime = imageMime(basename);
          if (!validImage(head, mime)) { await unlink(target); throw Object.assign(new Error(`Invalid image content: ${basename}`), { statusCode: 400 }); }
          images.push({ id: imageId, originalName: basename, mime, path: target });
        } else if (/^(?:readme|instructions)\.txt$/i.test(basename)) {
          for await (const _chunk of stream) { /* consume the documented optional text file */ }
        } else {
          throw Object.assign(new Error(`Unsupported ZIP file: ${name}`), { statusCode: 400 });
        }
        zip.readEntry();
      } catch (error) { fail(error); }
    });
    zip.on('end', () => (!requireSpreadsheet || spreadsheet) ? resolve({ spreadsheet, images }) : fail(Object.assign(new Error('ZIP must contain products.xlsx or products.csv.'), { statusCode: 400 })));
    zip.readEntry();
  });
}

async function parseRows(buffer, filename) {
  const workbook = new ExcelJS.Workbook();
  if (path.extname(filename).toLowerCase() === '.csv') await workbook.csv.load(buffer);
  else await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('Products') || workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 1) throw Object.assign(new Error('Spreadsheet has no Product sheet.'), { statusCode: 400 });
  const headers = sheet.getRow(1).values.slice(1).map((value) => safeCell(value));
  return sheet.getRows(2, Math.max(0, sheet.rowCount - 1)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row.getCell(index + 1).text || '']))).filter((row) => Object.values(row).some(Boolean));
}
function rowValue(row, key) {
  const found = Object.keys(row).find((column) => normalize(column).replaceAll(' ', '_') === key);
  return found === undefined ? '' : row[found];
}
function parseBoolean(value, fallback = false) {
  if (value === '' || value === undefined || value === null) return fallback;
  return ['true', '1', 'yes', 'y'].includes(normalize(value));
}
function parseImageNames(value) { return safeCell(value).split(/[;,\n]/).map((name) => path.basename(name.trim()).toLowerCase()).filter(Boolean); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function matchKnownLookup(records, evidence) {
  const text = safeCell(evidence);
  if (!text) return '';
  return records
    .filter((record) => safeCell(record.name).length > 1 && new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(normalize(record.name))}(?=$|[^a-z0-9])`, 'i').test(normalize(text)))
    .sort((left, right) => String(right.name).length - String(left.name).length)[0]?.name || '';
}
function knownLookupByName(records, name) {
  return records.find((record) => normalize(record.name) === normalize(name))?.name || '';
}
function catalogueCategory(records, item) {
  const description = `${item?.name || ''} ${item?.evidence || ''} ${item?.sectionEvidence || ''} ${item?.documentEvidence || ''}`;
  // These are description-led mappings, then resolved against the live
  // category list. A missing category is never fabricated.
  const preferred = /\b(?:down\s*light|spot\s*light|track\s*lights?|street\s*light|flood\s*light|surface\s*(?:cylinder|light)|bulb|luminaire|batten|tube|panel|strip\s*light|bollard|wall\s*washer|pendant\s*light|high\s*bay|well\s*glass|neon\s*flex|facade)\b/i.test(description) ? 'LED Lights'
    : /\b(?:switch|socket|bell\s*push|regulator|dnd|curtain)\b/i.test(description) ? 'Switches & Sockets'
      : /\b(?:usb|charger|connector|outlet|indicator|buzzer|lamp|fuse|rj[- ]|hdmi|volume\s*controller|shaver)\b/i.test(description) ? 'Electrical Accessories'
        : /\b(?:fan|exhaust|ventilat)\b/i.test(description) ? 'Fans'
          : /\b(?:wire|cable|conduit|flexible)\b/i.test(description) ? 'Wires & Cables'
            : /\b(?:mcb|rccb|rcbo|distribution\s*board|db\s*box|isolator)\b/i.test(description) ? 'Switchgear'
        : '';
  // Remaining verified TRIVO rows are modular plates, modules, touch controls
  // and switch variants in this catalogue section. Resolve that documented
  // catalogue grouping to the existing category, never a newly-created value.
  const trivoDefault = item?.trivo || normalize(item?.series) === 'trivo' ? knownLookupByName(records, 'Switches & Sockets') : '';
  // A controlled taxonomy proposal is permitted only for recognised product
  // types; arbitrary OCR headings never become categories.
  return (preferred && knownLookupByName(records, preferred)) || trivoDefault || matchKnownLookup(records, description) || preferred;
}
function catalogueBrand(records, item) {
  // The source is a verified TRIVO catalogue; select the existing GreatWhite
  // record only, rather than creating or guessing a manufacturer.
  if (item?.trivo || normalize(item?.series) === 'trivo') return knownLookupByName(records, 'GreatWhite');
  return matchKnownLookup(records, `${item?.brandEvidence || ''} ${item?.documentEvidence || ''} ${item?.evidence || ''}`) || safeCell(item?.brandEvidence);
}
export function catalogueImportRows(extraction, categories, brands, namesBySku) {
  return extraction.products.map((item) => {
    const specifications = [{ name: 'Catalogue MRP', value: item.mrp || '' }, ...(Array.isArray(item.specifications) ? item.specifications : [])];
    if (item.series) specifications.push({ name: 'Catalogue series', value: item.series });
    return {
      product_name: item.name || '', sku: item.sku || '', slug: slugify(`${item.name || ''}-${item.sku || ''}`), model_number: item.model || '', packing: item.packing || '', electrical_rating: item.rating || '',
      category: catalogueCategory(categories, item), brand: catalogueBrand(brands, item),
      stock_status: 'out_of_stock',
      specifications: JSON.stringify(specifications.filter((entry) => entry.value)), image_filename: (namesBySku.get(item.sku) || []).join('; '), __sourcePage: item.sourcePage, __confidence: item.confidence, __imageStatus: item.imageStatus, __requireImage: Boolean(item.sourcePage),
    };
  });
}
function publicRowsForJob(job) {
  return job.rows.map((row) => ({ ...row, product: { ...row.product, categoryRecord: undefined, brandRecord: undefined, images: row.product.images.map(({ id, originalName, mime }) => ({ id, originalName, mime })) } }));
}
function publicImagesForJob(job) {
  return job.images.map(({ id, originalName, mime, sourcePage, confidence, needsReview, candidateSkus }) => ({ id, originalName, mime, sourcePage: sourcePage || null, confidence: confidence ?? null, needsReview: Boolean(needsReview), candidateSkus: candidateSkus || [] }));
}

function productFromRow(row) {
  const name = safeCell(rowValue(row, 'product_name'));
  const sku = safeCell(rowValue(row, 'sku'));
  const product = {
    name, sku, slug: slugify(safeCell(rowValue(row, 'slug')) || name), description: safeCell(rowValue(row, 'description')) || null,
    short_description: safeCell(rowValue(row, 'short_description')) || null, category: safeCell(rowValue(row, 'category')),
    brand: safeCell(rowValue(row, 'brand')), model: safeCell(rowValue(row, 'model_number')), capacity: safeCell(rowValue(row, 'capacity_value')),
    capacity_unit: safeCell(rowValue(row, 'capacity_unit')), size: safeCell(rowValue(row, 'product_size')), rating: safeCell(rowValue(row, 'electrical_rating')),
    packing: safeCell(rowValue(row, 'packing')), price: safeCell(rowValue(row, 'price')), price_on_request: parseBoolean(rowValue(row, 'price_on_request')),
    stock_status: safeCell(rowValue(row, 'stock_status')) || 'in_stock', badge: safeCell(rowValue(row, 'product_badge')) || null,
    is_featured: parseBoolean(rowValue(row, 'is_featured')), is_active: rowValue(row, 'is_active') === '' ? true : parseBoolean(rowValue(row, 'is_active')),
    display_order: safeCell(rowValue(row, 'display_order')), imageNames: parseImageNames(rowValue(row, 'image_filename')), specifications: rowValue(row, 'specifications'),
  };
  return product;
}

async function validateImport({ dataBuffer, dataName, preParsedRows, images, adminId, options }) {
  const rows = preParsedRows || await parseRows(dataBuffer, dataName);
  if (!rows.length) throw Object.assign(new Error('The spreadsheet contains no product rows.'), { statusCode: 400 });
  if (rows.length > 5000) throw Object.assign(new Error('A single import is limited to 5,000 rows.'), { statusCode: 400 });
  const [categories, brands, products] = await Promise.all([
    query('SELECT id, name FROM categories'), query('SELECT id, name FROM brands'), query('SELECT id, sku, slug FROM products'),
  ]);
  const categoryMap = new Map(categories.map((item) => [normalize(item.name), item]));
  const brandMap = new Map(brands.map((item) => [normalize(item.name), item]));
  const existingSku = new Map(products.filter((item) => item.sku).map((item) => [normalize(item.sku), item]));
  const existingSlug = new Map(products.filter((item) => item.slug).map((item) => [normalize(item.slug), item]));
  const imageMap = new Map(images.map((image) => [normalize(image.originalName), image]));
  const seenSku = new Set(); const seenSlug = new Set();
  const normalizedOptions = { duplicateMode: options.duplicateMode === 'update' ? 'update' : 'skip', createMissing: parseBoolean(options.createMissing), defaultBrandId: Number(options.defaultBrandId) || null, defaultCategoryId: Number(options.defaultCategoryId) || null };
  const defaultBrand = brands.find((item) => item.id === normalizedOptions.defaultBrandId) || null;
  const defaultCategory = categories.find((item) => item.id === normalizedOptions.defaultCategoryId) || null;
  const preview = rows.map((source, index) => {
    const product = productFromRow(source); const errors = []; const warnings = [];
    if (!product.name) errors.push('Product name is required.');
    if (/^(?:upcoming|new|launching|coming\s+soon|led|dimension|dia\.?\s*x|l\s*x\s*w)$/i.test(product.name.trim()) || /(?:\bupcoming\b|\bnew\b|(?:dia|ø)\.?\s*x\s*h|\bcase\s+lot\b)/i.test(product.name)) errors.push('Product name is promotional or dimensional text and needs review.');
    if (!product.sku) errors.push('SKU is required.');
    if (!product.slug) errors.push('A slug could not be generated.');
    if (product.price && !Number.isFinite(Number(product.price))) errors.push('Price must be numeric.');
    if (!['in_stock', 'out_of_stock', 'limited', 'price_on_request'].includes(product.stock_status)) errors.push('Invalid stock status.');
    try { if (product.specifications) { const parsed = JSON.parse(product.specifications); if (!Array.isArray(parsed)) throw new Error(); product.specifications = parsed; } else product.specifications = []; } catch { errors.push('Specifications must be a JSON array.'); product.specifications = []; }
    const skuKey = normalize(product.sku); const slugKey = normalize(product.slug);
    const duplicateExisting = existingSku.get(skuKey) || existingSlug.get(slugKey);
    if (seenSku.has(skuKey)) errors.push('Duplicate SKU in spreadsheet.'); else if (skuKey) seenSku.add(skuKey);
    if (seenSlug.has(slugKey)) errors.push('Duplicate slug in spreadsheet.'); else if (slugKey) seenSlug.add(slugKey);
    if (duplicateExisting && normalizedOptions.duplicateMode === 'skip') warnings.push('Existing product will be skipped.');
    product.existingProductId = duplicateExisting?.id || null;
    product.categoryRecord = categoryMap.get(normalize(product.category)) || (!product.category ? defaultCategory : null);
    product.brandRecord = brandMap.get(normalize(product.brand)) || (!product.brand ? defaultBrand : null);
    if (!product.category && product.categoryRecord) product.category = product.categoryRecord.name;
    if (!product.brand && product.brandRecord) product.brand = product.brandRecord.name;
    if (!product.categoryRecord && product.category) (normalizedOptions.createMissing ? warnings : errors).push(`Missing category: ${product.category}`);
    if (!product.brandRecord && product.brand) (normalizedOptions.createMissing ? warnings : errors).push(`Missing brand: ${product.brand}`);
    if (!product.category) errors.push('Category is required.');
    if (!product.brand) errors.push('Brand is required.');
    const explicitImages = product.imageNames.map((name) => imageMap.get(normalize(name))).filter(Boolean);
    const skuImages = images.filter((image) => new RegExp(`^${product.sku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[-_.].+)?\\.(?:jpe?g|png|webp)$`, 'i').test(image.originalName));
    product.images = [...new Map([...explicitImages, ...skuImages].map((image) => [image.id, image])).values()];
    const unmatchedExplicit = product.imageNames.filter((name) => !imageMap.has(normalize(name)));
    if (unmatchedExplicit.length) errors.push(`Missing image file(s): ${unmatchedExplicit.join(', ')}`);
    if (!product.images.length) {
      const imageWarning = source.__imageStatus === 'no-photo-detected' ? 'No product photograph detected on the source page.'
        : source.__imageStatus === 'extraction-failed' ? 'Product photograph extraction failed on the source page.'
          : source.__imageStatus === 'review' ? 'A possible catalogue photograph is available for manual review.'
            : 'No matching images found.';
      warnings.push(imageWarning);
      if (source.__requireImage && source.__imageStatus !== 'no-photo-detected') errors.push('A verified product image is required before import.');
    }
    return { rowNumber: index + 2, product, errors, warnings, action: duplicateExisting ? normalizedOptions.duplicateMode : 'create', sourcePage: source.__sourcePage || null, confidence: source.__confidence || null, imageStatus: source.__imageStatus || null, imageRequired: Boolean(source.__requireImage) };
  });
  const assignedImages = new Set(preview.flatMap((row) => row.product.images.map((image) => image.id)));
  const unmatchedImages = images.filter((image) => !assignedImages.has(image.id)).map((image) => image.originalName);
  const summary = {
    total: preview.length, valid: preview.filter((row) => !row.errors.length && row.action === 'create').length,
    invalid: preview.filter((row) => row.errors.length).length, duplicates: preview.filter((row) => row.product.existingProductId).length,
    ready: preview.filter((row) => !row.errors.length && (row.action === 'create' || row.action === 'update')).length,
    // Every preview row without an assigned original image must be surfaced
    // for review, regardless of whether the catalogue says no photo exists,
    // extraction failed, or the candidate is uncertain.
    missingImages: preview.filter((row) => !row.product.images.length).length,
    unmatchedImages: unmatchedImages.length,
  };
  return { id: randomUUID(), ownerAdminId: adminId, status: 'validated', createdAt: new Date().toISOString(), options: normalizedOptions, rows: preview, images, unmatchedImages, summary, progress: { total: preview.length, processed: 0, created: 0, updated: 0, skipped: 0, failed: 0, matchedImages: 0, startedAt: null, finishedAt: null } };
}

async function applyReviewedRows(job, reviewedRows) {
  if (!Array.isArray(reviewedRows) || reviewedRows.length > job.rows.length) throw Object.assign(new Error('Invalid import review.'), { statusCode: 400 });
  const rowsByNumber = new Map(job.rows.map((row) => [Number(row.rowNumber), row]));
  const imagesById = new Map(job.images.map((image) => [image.id, image]));
  for (const patch of reviewedRows) {
    const row = rowsByNumber.get(Number(patch?.rowNumber));
    if (!row || !patch.product || typeof patch.product !== 'object') throw Object.assign(new Error('Invalid import review row.'), { statusCode: 400 });
    // Review is intentionally constrained to user-editable product metadata.  Paths,
    // image manifests, ownership, and import actions remain server-controlled.
    for (const field of ['name', 'sku', 'category', 'brand', 'model', 'packing', 'rating', 'size', 'description', 'short_description', 'stock_status']) {
      if (Object.hasOwn(patch.product, field)) row.product[field] = safeCell(patch.product[field]);
    }
    if (Object.hasOwn(patch.product, 'price')) row.product.price = safeCell(patch.product.price);
    if (Object.hasOwn(patch.product, 'imageIds')) {
      if (!Array.isArray(patch.product.imageIds) || patch.product.imageIds.length > 20) throw Object.assign(new Error('Invalid image assignment.'), { statusCode: 400 });
      const ids = [...new Set(patch.product.imageIds.map((id) => safeCell(id)).filter(Boolean))];
      const selected = ids.map((id) => imagesById.get(id));
      if (selected.some((image) => !image)) throw Object.assign(new Error('An assigned image is not part of this import.'), { statusCode: 400 });
      row.product.images = selected;
    }
    // Catalogue colour/finish variants often share their human-readable name.
    // Its verified SKU is therefore part of the generated PDF slug. Regular
    // spreadsheet imports retain their existing name-derived slug behaviour.
    row.product.slug = row.sourcePage ? slugify(`${row.product.name}-${row.product.sku}`) : slugify(row.product.name);
  }

  const [categories, brands, products] = await Promise.all([
    query('SELECT id, name FROM categories'), query('SELECT id, name FROM brands'), query('SELECT id, sku, slug FROM products'),
  ]);
  const categoryMap = new Map(categories.map((item) => [normalize(item.name), item]));
  const brandMap = new Map(brands.map((item) => [normalize(item.name), item]));
  const imageNames = new Set(job.images.map((image) => normalize(image.originalName)));
  const defaultCategory = categories.find((item) => Number(item.id) === Number(job.options.defaultCategoryId)) || null;
  const defaultBrand = brands.find((item) => Number(item.id) === Number(job.options.defaultBrandId)) || null;
  const existingSku = new Map(products.filter((item) => item.sku).map((item) => [normalize(item.sku), item]));
  const existingSlug = new Map(products.filter((item) => item.slug).map((item) => [normalize(item.slug), item]));
  const removableError = /^(Product name is required\.|SKU is required\.|A slug could not be generated\.|Price must be numeric\.|Invalid stock status\.|Category is required\.|Brand is required\.|A verified product image is required before import\.|Missing (?:category|brand):|Missing image file\(s\):|Duplicate (?:SKU|slug) in spreadsheet\.)/;
  const seenSku = new Set(); const seenSlug = new Set();
  for (const row of job.rows) {
    const product = row.product;
    row.errors = row.errors.filter((error) => !removableError.test(error));
    if (!product.name) row.errors.push('Product name is required.');
    if (!product.sku) row.errors.push('SKU is required.');
    if (!product.slug) row.errors.push('A slug could not be generated.');
    if (product.price && !Number.isFinite(Number(product.price))) row.errors.push('Price must be numeric.');
    if (!['in_stock', 'out_of_stock', 'limited', 'price_on_request'].includes(product.stock_status)) row.errors.push('Invalid stock status.');
    const skuKey = normalize(product.sku); const slugKey = normalize(product.slug);
    if (seenSku.has(skuKey)) row.errors.push('Duplicate SKU in spreadsheet.'); else if (skuKey) seenSku.add(skuKey);
    if (seenSlug.has(slugKey)) row.errors.push('Duplicate slug in spreadsheet.'); else if (slugKey) seenSlug.add(slugKey);
    const duplicateExisting = existingSku.get(skuKey) || existingSlug.get(slugKey);
    product.existingProductId = duplicateExisting?.id || null;
    row.action = duplicateExisting ? job.options.duplicateMode : 'create';
    product.categoryRecord = categoryMap.get(normalize(product.category)) || (!product.category ? defaultCategory : null);
    product.brandRecord = brandMap.get(normalize(product.brand)) || (!product.brand ? defaultBrand : null);
    if (!product.category && product.categoryRecord) product.category = product.categoryRecord.name;
    if (!product.brand && product.brandRecord) product.brand = product.brandRecord.name;
    if (!product.category) row.errors.push('Category is required.');
    if (!product.brand) row.errors.push('Brand is required.');
    if (!product.categoryRecord && product.category && !job.options.createMissing) row.errors.push(`Missing category: ${product.category}`);
    if (!product.brandRecord && product.brand && !job.options.createMissing) row.errors.push(`Missing brand: ${product.brand}`);
    // Preserve the original validation guarantee after Save review: a stale
    // catalogue filename may not disappear merely because review rechecks
    // editable fields. The reviewer must assign an available/new image or the
    // row remains in review.
    const missingExplicit = (product.imageNames || []).filter((name) => !imageNames.has(normalize(name)));
    if (missingExplicit.length) row.errors.push(`Missing image file(s): ${missingExplicit.join(', ')}`);
    row.warnings = row.warnings.filter((warning) => !/^(No product photograph detected on the source page\.|Product photograph extraction failed on the source page\.|A possible catalogue photograph is available for manual review\.|No matching images found\.)$/.test(warning));
    if (!product.images.length) {
      const imageWarning = row.imageStatus === 'no-photo-detected' ? 'No product photograph detected on the source page.'
        : row.imageStatus === 'extraction-failed' ? 'Product photograph extraction failed on the source page.'
          : row.imageStatus === 'review' ? 'A possible catalogue photograph is available for manual review.'
            : 'No matching images found.';
      row.warnings.push(imageWarning);
      if (row.imageRequired && row.imageStatus !== 'no-photo-detected') row.errors.push('A verified product image is required before import.');
    }
    row.warnings = row.warnings.filter((warning) => warning !== 'Existing product will be skipped.');
    if (duplicateExisting && job.options.duplicateMode === 'skip') row.warnings.push('Existing product will be skipped.');
  }
  job.summary = {
    total: job.rows.length,
    valid: job.rows.filter((row) => !row.errors.length && row.action === 'create').length,
    invalid: job.rows.filter((row) => row.errors.length).length,
    duplicates: job.rows.filter((row) => row.product.existingProductId).length,
    ready: job.rows.filter((row) => !row.errors.length && (row.action === 'create' || row.action === 'update')).length,
    missingImages: job.rows.filter((row) => !row.product.images.length).length,
    unmatchedImages: 0,
  };
  const assignedImages = new Set(job.rows.flatMap((row) => row.product.images.map((image) => image.id)));
  job.unmatchedImages = job.images.filter((image) => !assignedImages.has(image.id)).map((image) => image.originalName);
  job.summary.unmatchedImages = job.unmatchedImages.length;
}

async function ensureLookup(connection, type, name, existing, createMissing) {
  if (existing?.id) return existing.id;
  if (!name) return null;
  if (!createMissing) throw new Error(`Missing ${type}: ${name}`);
  const table = type === 'category' ? 'categories' : 'brands';
  const slug = slugify(name);
  const [matches] = await connection.execute(`SELECT id, name FROM ${table} WHERE LOWER(name) = LOWER(?) OR slug = ? LIMIT 1 FOR UPDATE`, [name, slug]);
  if (matches.length) {
    if (normalize(matches[0].name) !== normalize(name)) throw new Error(`The ${type} name conflicts with an existing lookup slug: ${matches[0].name}`);
    return matches[0].id;
  }
  const [result] = await connection.execute(`INSERT INTO ${table} (name, slug, is_active) VALUES (?, ?, 1)`, [name, slug]);
  return result.insertId;
}
async function copyImportedImage(image) {
  const storedName = `${Date.now()}-${randomUUID()}${path.extname(image.originalName).toLowerCase()}`;
  const destination = path.join(uploadsDir, storedName);
  await copyFile(image.path, destination);
  return { destination, imagePath: `/uploads/${storedName}` };
}
async function importRow(job, row, hasDisplayOrder) {
  const product = row.product;
  if (row.errors.length || (row.action === 'skip')) return { outcome: row.errors.length ? 'failed' : 'skipped', reason: row.errors.join(' ') || 'Existing product skipped.' };
  const connection = await pool.getConnection(); const copied = [];
  try {
    await connection.beginTransaction();
    const categoryId = await ensureLookup(connection, 'category', product.category, product.categoryRecord, job.options.createMissing);
    const brandId = await ensureLookup(connection, 'brand', product.brand, product.brandRecord, job.options.createMissing);
    let productId = product.existingProductId;
    if (row.action === 'update' && productId) {
      await connection.execute('UPDATE products SET name = ?, description = ?, short_description = ?, category_id = ?, brand_id = ?, price = ?, price_on_request = ?, stock_status = ?, is_featured = ?, is_active = ?, badge = ?, size = ? WHERE id = ?', [product.name, product.description, product.short_description, categoryId, brandId, product.price ? Number(product.price) : null, Number(product.price_on_request), product.stock_status, Number(product.is_featured), Number(product.is_active), product.badge, product.size || null, productId]);
    } else {
      const insert = productInsertValues({ name: product.name, slug: product.slug, sku: product.sku, description: product.description, short_description: product.short_description, category_id: categoryId, brand_id: brandId, price: product.price ? Number(product.price) : null, price_on_request: Number(product.price_on_request), stock_status: product.stock_status, is_featured: Number(product.is_featured), is_best_selling: 0, display_order: product.display_order || 0, is_active: Number(product.is_active), badge: product.badge, size: product.size || null, image: null, meta_title: null, meta_description: null }, hasDisplayOrder);
      const [result] = await connection.execute(`INSERT INTO products (${insert.columns.join(', ')}) VALUES (${insert.columns.map(() => '?').join(', ')})`, insert.values);
      productId = result.insertId;
    }
    const specifications = mergePresentationSpecifications(product.specifications, product);
    await connection.execute('DELETE FROM product_specifications WHERE product_id = ?', [productId]);
    for (const specification of specifications) if (specification?.name && specification?.value) await connection.execute('INSERT INTO product_specifications (product_id, name, value) VALUES (?, ?, ?)', [productId, String(specification.name), String(specification.value)]);
    const existingImages = await connection.execute('SELECT COUNT(*) AS total FROM product_images WHERE product_id = ?', [productId]);
    let imageOrder = Number(existingImages[0][0].total || 0);
    for (const image of product.images) {
      const stored = await copyImportedImage(image); copied.push(stored.destination);
      await connection.execute('INSERT INTO product_images (product_id, image_path, is_primary, display_order) VALUES (?, ?, ?, ?)', [productId, stored.imagePath, imageOrder === 0 ? 1 : 0, imageOrder]);
      imageOrder += 1;
    }
    await connection.commit();
    return { outcome: row.action === 'update' ? 'updated' : 'created', productId, matchedImages: product.images.length };
  } catch (error) {
    await connection.rollback(); await Promise.all(copied.map((file) => unlink(file).catch(() => {}))); return { outcome: 'failed', reason: error.message };
  } finally { connection.release(); }
}
async function runImport(job) {
  activeJobs.add(job.id); job.status = 'processing'; job.progress.startedAt = new Date().toISOString(); await saveJob(job);
  const hasDisplayOrder = await hasProductDisplayOrder();
  try {
    const candidates = job.rows.filter((row) => !row.errors.length);
    for (let start = 0; start < candidates.length; start += BATCH_SIZE) {
      const current = await loadJob(job.id, job.ownerAdminId);
      if (current.cancelRequested) { job.status = 'cancelled'; break; }
      for (const row of candidates.slice(start, start + BATCH_SIZE)) {
        const result = await importRow(job, row, hasDisplayOrder);
        row.importResult = result; job.progress.processed += 1; job.progress[result.outcome] = (job.progress[result.outcome] || 0) + 1; job.progress.matchedImages += result.matchedImages || 0;
      }
      await saveJob(job); await new Promise((resolve) => setImmediate(resolve));
    }
    if (job.status === 'processing') job.status = 'completed';
  } catch (error) { job.status = 'failed'; job.fatalError = error.message; }
  job.progress.finishedAt = new Date().toISOString(); await saveJob(job); activeJobs.delete(job.id);
}

async function runPdfExtraction(jobId, adminId, sourcePath, originalName, options) {
  let job = await loadJob(jobId, adminId);
  const startedAt = Date.now();
  try {
    const bytes = await readFile(sourcePath); const hash = createHash('sha256').update(bytes).digest('hex');
    let extraction = await readPdfCache(hash); const cacheHit = Boolean(extraction);
    if (!extraction) {
      extraction = await extractPdfCatalogue(bytes, { onProgress: async (progress) => {
        job = await loadJob(jobId, adminId);
        if (job.cancelRequested) throw Object.assign(new Error('Extraction cancelled.'), { cancelled: true });
        const known = new Set((job.partialProducts || []).map((item) => item.sku));
        const additions = (progress.products || []).filter((item) => item.sku && !known.has(item.sku));
        // Keep only metadata required by the in-progress preview. Full rows
        // remain private until duplicate/category validation has completed.
        job.partialProducts = [...(job.partialProducts || []), ...additions].slice(0, 250);
        job.extractionProgress = { ...progress, elapsedMs: Date.now() - startedAt, stage: 'extracting' };
        await saveJob(job);
      } });
      await writePdfCache(hash, extraction);
    }
    const images = []; const namesBySku = new Map();
    for (const extracted of extraction.images) {
      const id = `${randomUUID()}.png`; const name = extracted.skus?.[0] ? `${extracted.skus[0]}-page-${extracted.sourcePage}-${id}.png` : extracted.filename;
      const target = thumbnailPath(jobId, id); await writeFile(target, extracted.buffer, { flag: 'wx' });
      images.push({ id, originalName: name, mime: extracted.mime, path: target, sourcePage: extracted.sourcePage, confidence: extracted.confidence, needsReview: Boolean(extracted.needsReview), candidateSkus: extracted.candidateSkus || [] });
      for (const sku of extracted.skus || []) namesBySku.set(sku, [...(namesBySku.get(sku) || []), name]);
    }
    const [categories, brands] = await Promise.all([query('SELECT id, name FROM categories'), query('SELECT id, name FROM brands')]);
    const rows = catalogueImportRows(extraction, categories, brands, namesBySku);
    const validated = await validateImport({ dataBuffer: bytes, dataName: originalName, preParsedRows: rows, images, adminId, options });
    validated.id = jobId; validated.pdf = { filename: originalName, pageCount: extraction.pageCount, nativeTextFound: extraction.nativeTextFound, cacheHit, parserVersion: PDF_PARSER_VERSION, sha256: hash }; validated.extractionProgress = { pageNumber: extraction.pageCount, pageCount: extraction.pageCount, totalProducts: rows.length, totalImages: images.length, elapsedMs: Date.now() - startedAt, stage: 'validated' };
    await saveJob(validated);
  } catch (error) { job = await loadJob(jobId, adminId); job.status = error.cancelled ? 'cancelled' : 'failed'; job.fatalError = error.cancelled ? null : error.message; job.extractionProgress = { ...(job.extractionProgress || {}), elapsedMs: Date.now() - startedAt, stage: job.status }; await saveJob(job); }
  finally { for (const [hash, active] of activePdfHashes) if (active.jobId === jobId) activePdfHashes.delete(hash); }
}

router.get('/template', requireAuth, async (req, res, next) => {
  const type = req.query.type === 'csv' ? 'csv' : 'xlsx';
  const columns = ['product_name', 'sku', 'description', 'short_description', 'category', 'brand', 'model_number', 'capacity_value', 'capacity_unit', 'product_size', 'electrical_rating', 'packing', 'price', 'price_on_request', 'stock_status', 'product_badge', 'is_featured', 'display_order', 'is_active', 'specifications', 'image_filename'];
  const example = { product_name: 'Example LED Bulb (remove this row before import)', sku: 'EXAMPLE-SKU', category: 'Lighting', brand: 'Example Brand', model_number: 'EX-9W', price: '0', price_on_request: 'true', stock_status: 'in_stock', is_active: 'true', specifications: '[{"name":"Wattage","value":"9W"}]', image_filename: 'EXAMPLE-SKU.jpg; EXAMPLE-SKU-side.jpg' };
  try { const workbook = new ExcelJS.Workbook(); const productSheet = workbook.addWorksheet('Products'); productSheet.columns = columns.map((key) => ({ header: key, key, width: 22 })); productSheet.addRow(example); const instructions = workbook.addWorksheet('Instructions'); instructions.addRows([['Instructions'], ['Delete the example row before importing.'], ['Use image_filename for comma or semicolon-separated files in images/.'], ['Specifications must be a JSON array: [{"name":"Model","value":"ABC"}].']]); const output = type === 'csv' ? await workbook.csv.writeBuffer() : await workbook.xlsx.writeBuffer(); res.type(type === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(`products-template.${type}`).send(Buffer.from(output)); } catch (error) { next(error); }
});

router.get('/sample-zip', requireAuth, async (req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Products'); sheet.columns = [{ header: 'product_name', key: 'product_name' }, { header: 'sku', key: 'sku' }, { header: 'image_filename', key: 'image_filename' }]; sheet.addRow({ product_name: 'Example product (delete before import)', sku: 'EXAMPLE-SKU', image_filename: 'EXAMPLE-SKU.png' });
    const zip = new yazl.ZipFile(); zip.addBuffer(Buffer.from(await workbook.xlsx.writeBuffer()), 'products.xlsx'); zip.addBuffer(tinyPng, 'images/EXAMPLE-SKU.png'); zip.addBuffer(Buffer.from('Delete the example spreadsheet row before importing.\n', 'utf8'), 'README.txt');
    res.type('application/zip').attachment('products-import-sample.zip'); zip.outputStream.pipe(res); zip.end();
  } catch (error) { next(error); }
});

router.post('/validate', requireAuth, importUpload.fields([{ name: 'bundle', maxCount: 1 }, { name: 'dataFile', maxCount: 1 }, { name: 'cataloguePdf', maxCount: 1 }, { name: 'imagesZip', maxCount: 1 }, { name: 'images', maxCount: 12 }]), async (req, res, next) => {
  const temporaryUploads = Object.values(req.files || {}).flat(); let directory;
  try {
    directory = jobDirectory(randomUUID()); await mkdir(directory, { recursive: true });
    let data; let images = [];
    const bundle = req.files?.bundle?.[0]; const cataloguePdf = req.files?.cataloguePdf?.[0]; let preParsedRows; let pdfExtraction; let pdfCacheHit = false;
    if (cataloguePdf) {
      if (!['application/pdf', 'application/x-pdf'].includes(String(cataloguePdf.mimetype).toLowerCase())) throw Object.assign(new Error('Catalogue upload must be a PDF file.'), { statusCode: 400 });
      if (!cataloguePdf.size || cataloguePdf.size > MAX_ZIP_BYTES) throw Object.assign(new Error('Catalogue PDF exceeds the allowed size.'), { statusCode: 400 });
      const head = await readFile(cataloguePdf.path); if (head.subarray(0, 5).toString('ascii') !== '%PDF-') throw Object.assign(new Error('Uploaded catalogue is not a valid PDF.'), { statusCode: 400 });
      const hash = createHash('sha256').update(head).digest('hex');
      const active = activePdfHashes.get(hash);
      if (active?.adminId === req.admin.id) {
        await rm(directory, { recursive: true, force: true });
        return res.status(202).json({ success: true, data: { jobId: active.jobId, status: 'extracting', reused: true } });
      }
      const jobId = path.basename(directory); const sourcePath = path.join(directory, 'source.pdf'); await copyFile(cataloguePdf.path, sourcePath); await mkdir(path.join(directory, 'images'), { recursive: true });
      const job = { id: jobId, ownerAdminId: req.admin.id, status: 'extracting', createdAt: new Date().toISOString(), options: req.body, rows: [], images: [], partialProducts: [], unmatchedImages: [], pdf: { filename: cataloguePdf.originalname, sha256: hash, parserVersion: PDF_PARSER_VERSION, cacheHit: false }, summary: { total: 0, valid: 0, invalid: 0, duplicates: 0, ready: 0, missingImages: 0, unmatchedImages: 0 }, progress: { total: 0, processed: 0 }, extractionProgress: { pageNumber: 0, pageCount: 0, processedPages: 0, totalProducts: 0, totalImages: 0, elapsedMs: 0, stage: 'queued' } };
      await saveJob(job); cleanupPdfCache().catch(() => {}); activePdfHashes.set(hash, { jobId, adminId: req.admin.id }); setImmediate(() => runPdfExtraction(jobId, req.admin.id, sourcePath, cataloguePdf.originalname, req.body));
      return res.status(202).json({ success: true, data: { jobId, status: 'extracting', currentPdfParserVersion: PDF_PARSER_VERSION, extractionProgress: job.extractionProgress } });
    }
    if (cataloguePdf) {
      if (!['application/pdf', 'application/x-pdf'].includes(String(cataloguePdf.mimetype).toLowerCase())) throw Object.assign(new Error('Catalogue upload must be a PDF file.'), { statusCode: 400 });
      if (!cataloguePdf.size || cataloguePdf.size > MAX_ZIP_BYTES) throw Object.assign(new Error('Catalogue PDF exceeds the allowed size.'), { statusCode: 400 });
      const bytes = await readFile(cataloguePdf.path);
      if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw Object.assign(new Error('Uploaded catalogue is not a valid PDF.'), { statusCode: 400 });
      const pdfHash = createHash('sha256').update(bytes).digest('hex');
      pdfExtraction = await readPdfCache(pdfHash);
      pdfCacheHit = Boolean(pdfExtraction);
      if (!pdfExtraction) {
        pdfExtraction = await extractPdfCatalogue(bytes);
        await writePdfCache(pdfHash, pdfExtraction);
      }
      if (!pdfExtraction.products.length) throw Object.assign(new Error('No labelled product SKU was found in this PDF. Use a text-based catalogue or correct the catalogue before import.'), { statusCode: 400 });
      const [categories, brands] = await Promise.all([query('SELECT id, name FROM categories'), query('SELECT id, name FROM brands')]);
      await mkdir(path.join(directory, 'images'), { recursive: true });
      const pdfImageNamesBySku = new Map();
      for (const extractedImage of pdfExtraction.images) {
        const id = `${randomUUID()}.png`;
        const filename = extractedImage.skus?.[0] ? `${extractedImage.skus[0]}-page-${extractedImage.sourcePage}-${id}.png` : extractedImage.filename;
        const target = thumbnailPath(path.basename(directory), id);
        await writeFile(target, extractedImage.buffer, { flag: 'wx' });
        const image = { id, originalName: filename, mime: extractedImage.mime, path: target, sourcePage: extractedImage.sourcePage, confidence: extractedImage.confidence, needsReview: Boolean(extractedImage.needsReview), candidateSkus: extractedImage.candidateSkus || [] };
        images.push(image);
        for (const sku of extractedImage.skus || []) pdfImageNamesBySku.set(sku, [...(pdfImageNamesBySku.get(sku) || []), filename]);
      }
      preParsedRows = catalogueImportRows(pdfExtraction, categories, brands, pdfImageNamesBySku);
      data = { name: cataloguePdf.originalname, buffer: bytes };
    } else if (bundle) ({ spreadsheet: data, images } = await extractBundle(bundle.path, directory));
    else {
      const dataFile = req.files?.dataFile?.[0]; if (!dataFile || !['.xlsx', '.csv'].includes(path.extname(dataFile.originalname).toLowerCase())) throw Object.assign(new Error('Upload a CSV or XLSX product file, or one combined ZIP.'), { statusCode: 400 });
      data = { name: dataFile.originalname, buffer: await readFile(dataFile.path) };
      const imagesZip = req.files?.imagesZip?.[0]; if (imagesZip) { const extracted = await extractBundle(imagesZip.path, directory, { requireSpreadsheet: false }); images = extracted.images; }
      for (const file of req.files?.images || []) { const mime = imageMime(file.originalname); const bytes = await readFile(file.path); if (!mime || !validImage(bytes.subarray(0, 12), mime)) throw Object.assign(new Error(`Invalid image: ${file.originalname}`), { statusCode: 400 }); const id = `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`; await mkdir(path.join(directory, 'images'), { recursive: true }); const target = thumbnailPath(path.basename(directory), id); await copyFile(file.path, target); images.push({ id, originalName: path.basename(file.originalname), mime, path: target }); }
    }
    const job = await validateImport({ dataBuffer: data.buffer, dataName: data.name, preParsedRows, images, adminId: req.admin.id, options: req.body });
    if (cataloguePdf) job.pdf = { filename: cataloguePdf.originalname, pageCount: pdfExtraction.pageCount, nativeTextFound: pdfExtraction.nativeTextFound, cacheHit: pdfCacheHit, parserVersion: PDF_PARSER_VERSION };
    const finalDirectory = jobDirectory(job.id); await mkdir(finalDirectory, { recursive: true }); await mkdir(path.join(finalDirectory, 'images'), { recursive: true });
    for (const image of images) { const target = thumbnailPath(job.id, image.id); await copyFile(image.path, target); image.path = target; }
    await saveJob(job); await rm(directory, { recursive: true, force: true });
    const publicRows = publicRowsForJob(job);
    res.status(201).json({ success: true, data: { jobId: job.id, summary: job.summary, rows: publicRows, images: publicImagesForJob(job), unmatchedImages: job.unmatchedImages, options: job.options } });
  } catch (error) { if (directory) await rm(directory, { recursive: true, force: true }); next(error); }
  finally { await Promise.all(temporaryUploads.map((file) => unlink(file.path).catch(() => {}))); }
});

router.put('/review/:jobId', requireAuth, async (req, res, next) => {
  try {
    const job = await loadJob(req.params.jobId, req.admin.id);
    if (job.status !== 'validated') return res.status(409).json({ success: false, message: 'Only a validated import can be reviewed.' });
    await applyReviewedRows(job, req.body?.rows);
    await saveJob(job);
    return res.json({ success: true, data: { jobId: job.id, summary: job.summary, rows: publicRowsForJob(job), images: publicImagesForJob(job), unmatchedImages: job.unmatchedImages, options: job.options } });
  } catch (error) { next(error); }
});

router.post('/images/:jobId', requireAuth, importUpload.array('images', 12), async (req, res, next) => {
  const temporary = req.files || []; const created = [];
  try {
    const job = await loadJob(req.params.jobId, req.admin.id);
    if (job.status !== 'validated') return res.status(409).json({ success: false, message: 'Images can only be added to a validated import.' });
    if (!temporary.length) throw Object.assign(new Error('Choose at least one product image.'), { statusCode: 400 });
    for (const file of temporary) {
      const mime = imageMime(file.originalname);
      const bytes = await readFile(file.path);
      if (!mime || bytes.length > MAX_IMAGE_BYTES || !validImage(bytes, mime)) throw Object.assign(new Error(`Invalid product image: ${path.basename(file.originalname)}`), { statusCode: 400 });
      const id = `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
      const target = thumbnailPath(job.id, id);
      await copyFile(file.path, target);
      created.push(target);
      job.images.push({ id, originalName: path.basename(file.originalname), mime, path: target, sourcePage: null, confidence: null, needsReview: true, candidateSkus: [] });
    }
    const assigned = new Set(job.rows.flatMap((row) => row.product.images.map((image) => image.id)));
    job.unmatchedImages = job.images.filter((image) => !assigned.has(image.id)).map((image) => image.originalName);
    job.summary.unmatchedImages = job.unmatchedImages.length;
    await saveJob(job);
    return res.status(201).json({ success: true, data: { images: publicImagesForJob(job), unmatchedImages: job.unmatchedImages, summary: job.summary } });
  } catch (error) {
    await Promise.all(created.map((file) => unlink(file).catch(() => {})));
    return next(error);
  } finally {
    await Promise.all(temporary.map((file) => unlink(file.path).catch(() => {})));
  }
});
router.post('/start/:jobId', requireAuth, async (req, res, next) => {
  try {
    const job = await loadJob(req.params.jobId, req.admin.id);
    if (activeJobs.has(job.id) || job.status === 'processing') return res.status(409).json({ success: false, message: 'This import is already processing.' });
    if (!['validated', 'cancelled', 'interrupted'].includes(job.status)) return res.status(409).json({ success: false, message: 'This import cannot be started again.' });
    if (job.status === 'validated') {
      await applyReviewedRows(job, []);
      if (!job.summary.ready) {
        await saveJob(job);
        return res.status(409).json({ success: false, message: 'No products meet the import requirements.', data: { summary: job.summary } });
      }
    }
    job.status = 'queued'; job.cancelRequested = false; await saveJob(job); runImport(job); await logAdminActivity(req.admin.id, 'bulk_import_started', 'product_import', null, { jobId: job.id }); return res.status(202).json({ success: true, data: { jobId: job.id, status: job.status, progress: job.progress, summary: job.summary } });
  } catch (error) { next(error); }
});
router.get('/status/:jobId', requireAuth, async (req, res, next) => { try { const job = await loadJob(req.params.jobId, req.admin.id); const summary = job.status === 'validated' ? { ...job.summary, missingImages: job.rows.filter((row) => !row.product.images.length).length } : job.summary; const diagnostics = process.env.NODE_ENV === 'production' || !job.pdf ? undefined : { jobId: job.id, pdfSha256: job.pdf.sha256 || null, parserVersion: job.pdf.parserVersion || null, currentParserVersion: PDF_PARSER_VERSION, cacheHit: Boolean(job.pdf.cacheHit) }; res.json({ success: true, data: { jobId: job.id, status: job.status, summary, progress: job.progress, extractionProgress: job.extractionProgress || null, partialProducts: job.status === 'extracting' ? (job.partialProducts || []) : [], rows: job.status === 'validated' ? publicRowsForJob(job) : [], images: job.status === 'validated' ? publicImagesForJob(job) : [], unmatchedImages: job.status === 'validated' ? (job.unmatchedImages || []) : [], pdf: job.pdf || null, currentPdfParserVersion: PDF_PARSER_VERSION, ...(diagnostics ? { diagnostics } : {}), fatalError: job.fatalError || null } }); } catch (error) { next(error); } });
router.get('/source/:jobId', requireAuth, async (req, res, next) => {
  try {
    const job = await loadJob(req.params.jobId, req.admin.id);
    const source = path.join(jobDirectory(job.id), 'source.pdf');
    const bytes = await readFile(source);
    res.type('application/pdf').set('Cache-Control', 'private, max-age=300').send(bytes);
  } catch (error) { next(error); }
});
router.post('/cancel/:jobId', requireAuth, async (req, res, next) => { try { const job = await loadJob(req.params.jobId, req.admin.id); job.cancelRequested = true; if (job.status === 'validated' || job.status === 'queued') job.status = 'cancelled'; await saveJob(job); res.json({ success: true, message: 'Import cancellation requested.' }); } catch (error) { next(error); } });
router.get('/thumbnail/:jobId/:imageId', requireAuth, async (req, res, next) => { try { const job = await loadJob(req.params.jobId, req.admin.id); const image = job.images.find((entry) => entry.id === req.params.imageId); if (!image) return res.status(404).json({ success: false, message: 'Preview image not found.' }); const imageRoot = `${path.resolve(jobDirectory(job.id), 'images')}${path.sep}`; const imagePath = path.resolve(image.previewPath || image.path); if (!imagePath.startsWith(imageRoot)) return res.status(404).json({ success: false, message: 'Preview image not found.' }); res.set('Cache-Control', 'private, no-store'); return res.type(image.mime).sendFile(imagePath); } catch (error) { next(error); } });
router.get('/report/:jobId', requireAuth, async (req, res, next) => { try { const job = await loadJob(req.params.jobId, req.admin.id); const lines = [['row_number', 'sku', 'product_name', 'source_page', 'confidence', 'status', 'reason']]; job.rows.forEach((row) => lines.push([row.rowNumber, row.product.sku, row.product.name, row.sourcePage || '', row.confidence ?? '', row.importResult?.outcome || (row.errors.length ? 'invalid' : row.action), row.importResult?.reason || [...row.errors, ...row.warnings].join(' | ')])); const csv = lines.map((line) => line.map((value) => `"${safeCsv(value).replaceAll('"', '""')}"`).join(',')).join('\r\n'); res.type('text/csv').attachment(`product-import-${job.id}-report.csv`).send(csv); } catch (error) { next(error); } });

export default router;
