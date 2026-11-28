// Free local FIANA catalogue-to-Bulk-Import converter.
// Usage: node scripts/convert-fiana-catalogue-to-zip.js [source.pdf] [output-dir]
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import yazl from 'yazl';
import { extractPdfCatalogue } from '../services/pdfCatalogue.js';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const projectDirectory = path.dirname(backendDirectory);
const downloadsDirectory = path.dirname(projectDirectory);
const sourcePath = process.argv[2] || path.join(downloadsDirectory, 'Fiana  MRP PRICELIST  - SEPTEMBER 2026.pdf');
const outputDirectory = process.argv[3] || path.join(process.env.IMPORT_STORAGE_ROOT || path.join(backendDirectory, 'private-imports'), 'catalogue-conversions', 'FIANA');
const columns = ['product_name', 'sku', 'description', 'short_description', 'category', 'brand', 'model_number', 'capacity_value', 'capacity_unit', 'product_size', 'electrical_rating', 'packing', 'price', 'price_on_request', 'stock_status', 'product_badge', 'is_featured', 'display_order', 'is_active', 'specifications', 'image_filename'];

function safeFile(value) { return String(value || '').replace(/[^A-Za-z0-9._-]/g, '-').replace(/-+/g, '-'); }
function categoryFor(product) {
  const text = `${product.name || ''} ${product.evidence || ''} ${product.sectionEvidence || ''}`;
  if (/\b(?:switch|socket|plate|bell|regulator|dnd|curtain|shaver|hotel)\b/i.test(text)) return 'Switches & Sockets';
  if (/\b(?:mcb|dp|sp|overload|protection)\b/i.test(text)) return 'Switchgear';
  return '';
}
function brandFor(product) {
  return /\bgreat\s*white\b/i.test(`${product.brandEvidence || ''} ${product.documentEvidence || ''}`) ? 'GreatWhite' : '';
}
function specificationsFor(product) {
  return [
    product.mrp ? { name: 'Catalogue MRP', value: String(product.mrp) } : null,
    product.series ? { name: 'Catalogue series', value: product.series } : null,
    product.model ? { name: 'Model', value: product.model } : null,
    product.rating ? { name: 'Electrical rating', value: product.rating } : null,
    product.packing ? { name: 'Packing', value: product.packing } : null,
    ...(Array.isArray(product.specifications) ? product.specifications : []),
  ].filter((entry) => entry?.value);
}
async function writeZip(target, files) {
  await new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    for (const file of files) zip.addBuffer(file.buffer, file.name);
    zip.outputStream.pipe(createWriteStream(target)).on('close', resolve).on('error', reject);
    zip.end();
  });
}

await mkdir(outputDirectory, { recursive: true });
const imagesDirectory = path.join(outputDirectory, 'images');
await mkdir(imagesDirectory, { recursive: true });
const source = await readFile(sourcePath);
const extraction = await extractPdfCatalogue(source);
const imageBySku = new Map();
const zipFiles = [];
const matchedImageIds = new Set();
for (const image of extraction.images) {
  if (image.needsReview || !image.skus?.length || !image.buffer) continue;
  const sourceImageId = safeFile(String(image.id || image.filename || `page-${image.sourcePage || 'unknown'}`).replace(/\.[A-Za-z0-9]{1,5}$/i, ''));
  // One original asset may be evidence for several variants.  Keep a single
  // physical file and reference it from each supported SKU; creating a name
  // per SKU would leave later variants pointing at a ZIP entry that was never
  // written once the asset is deduplicated.
  const filename = `source-page-${safeFile(image.sourcePage || 'unknown')}-${sourceImageId}.png`;
  const assetId = image.id || image.filename || filename;
  if (!matchedImageIds.has(assetId)) {
    matchedImageIds.add(assetId);
    await writeFile(path.join(imagesDirectory, filename), image.buffer);
    zipFiles.push({ name: `images/${filename}`, buffer: image.buffer });
  }
  for (const sku of image.skus) {
    imageBySku.set(sku, [...(imageBySku.get(sku) || []), filename]);
  }
}
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Products');
sheet.columns = columns.map((key) => ({ header: key, key, width: 24 }));
const unresolved = [];
for (const product of extraction.products) {
  const images = imageBySku.get(product.sku) || [];
  const category = categoryFor(product); const brand = brandFor(product);
  const uncertainties = [];
  if (!product.name) uncertainties.push('Missing source product name');
  if (!category) uncertainties.push('Category requires review');
  if (!brand) uncertainties.push('Brand requires review');
  if (!images.length) uncertainties.push('No verified original photograph');
  if (product.imageStatus === 'review') uncertainties.push('Image candidate requires manual verification');
  sheet.addRow({
    product_name: product.name || '', sku: product.sku || '', description: '', short_description: '', category, brand,
    model_number: product.model || '', capacity_value: '', capacity_unit: '', product_size: '', electrical_rating: product.rating || '', packing: product.packing || '',
    price: '', price_on_request: 'false', stock_status: 'out_of_stock', product_badge: '', is_featured: 'false', display_order: '', is_active: 'true',
    specifications: JSON.stringify(specificationsFor(product)), image_filename: images.join('; '),
  });
  if (uncertainties.length) unresolved.push({ sku: product.sku, sourcePage: product.sourcePage, name: product.name || '', confidence: product.confidence, issues: uncertainties, evidence: product.evidence || '' });
}
const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
const report = {
  source: { file: path.basename(sourcePath), sha256: createHash('sha256').update(source).digest('hex'), pages: extraction.pageCount, parser: 'trivo-table-v42' },
  inventory: {
    extractedSkus: extraction.products.map((product) => product.sku).filter(Boolean),
    extractedCount: extraction.products.length,
    verifiedImageCount: matchedImageIds.size,
    // The extraction engine cannot claim absent SKUs without an independently
    // verified source inventory.  It does record pages that yielded no rows so
    // an administrator can audit them instead of receiving invented codes.
    pagesWithoutExtractedProducts: Array.from({ length: extraction.pageCount || 0 }, (_, index) => index + 1)
      .filter((page) => !extraction.products.some((product) => Number(product.sourcePage) === page)),
    unmatchedImages: extraction.images.filter((image) => image.needsReview).map((image) => ({ filename: image.filename, page: image.sourcePage, candidates: image.candidateSkus || [] })),
  },
  unresolved,
  limitation: 'Rows without a verified source photograph are deliberately retained in this report and are not assigned an unrelated image.',
};
const xlsxPath = path.join(outputDirectory, 'products.xlsx');
const reportPath = path.join(outputDirectory, 'FIANA-conversion-report.json');
const zipPath = path.join(outputDirectory, 'FIANA-Products.zip');
await writeFile(xlsxPath, xlsx); await writeFile(reportPath, JSON.stringify(report, null, 2));
// Keep the audit report beside the bundle.  The importer intentionally rejects
// arbitrary ZIP entries, so placing JSON in this archive would make a valid
// import package fail validation.
zipFiles.unshift({ name: 'products.xlsx', buffer: xlsx }, { name: 'README.txt', buffer: Buffer.from('Generated locally from the FIANA catalogue. Rows without an image remain in review and must not be imported until corrected.\n', 'utf8') });
await writeZip(zipPath, zipFiles);
console.log(JSON.stringify({ source: sourcePath, outputDirectory, zipPath, xlsxPath, reportPath, products: extraction.products.length, verifiedImages: matchedImageIds.size, unresolved: unresolved.length, pages: extraction.pageCount }, null, 2));
