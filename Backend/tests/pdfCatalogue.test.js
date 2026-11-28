import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfCatalogue, pdfDocumentOptions, renderPdfPage } from '../services/pdfCatalogue.js';
import { reconstructCatalogueMatrices } from '../services/catalogueTableEngine.js';

function makePdf(lines) {
  const stream = `BT\n/F1 18 Tf\n${lines.map((line, index) => `1 0 0 1 72 ${760 - index * 28} Tm (${line.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')}) Tj\n`).join('')}ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

function makeMultiProductPdf(imagePositions = [520, 180]) {
  const image = (red, green, blue) => deflateSync(Buffer.alloc(100 * 100 * 3).fill(Buffer.from([red, green, blue])));
  const imageObject = (bytes) => Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 100 /Height 100 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${bytes.length} >>\nstream\n`, 'ascii'), bytes, Buffer.from('\nendstream', 'ascii')]);
  const stream = `BT\n/F1 18 Tf\n1 0 0 1 72 700 Tm (TRIVO WIDGET A) Tj\n1 0 0 1 72 670 Tm (SKU: A001) Tj\n1 0 0 1 72 400 Tm (TRIVO WIDGET B) Tj\n1 0 0 1 72 370 Tm (SKU: B002) Tj\nET\nq 120 0 0 120 72 ${imagePositions[0]} cm /Im1 Do Q\nq 120 0 0 120 72 ${imagePositions[1]} cm /Im2 Do Q`;
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'), Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 5 0 R /Im2 6 0 R >> >> /Contents 7 0 R >>'),
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'), imageObject(image(200, 20, 20)), imageObject(image(20, 40, 200)),
    Buffer.from(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`),
  ];
  const chunks = [Buffer.from('%PDF-1.4\n', 'ascii')]; const offsets = [0]; let offset = chunks[0].length;
  objects.forEach((object, index) => { offsets.push(offset); const part = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'ascii'), object, Buffer.from('\nendobj\n', 'ascii')]); chunks.push(part); offset += part.length; });
  const xref = offset; const trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((entry) => `${String(entry).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.concat([...chunks, Buffer.from(trailer, 'ascii')]);
}

test('extracts and renders a native catalogue page without treating MRP as price', async () => {
  const fixture = makePdf(['TRIVO LED BULB', 'SKU: 50101', 'MODEL: TV-9W', 'MRP: Rs. 999', 'PACKING: 10 PCS']);
  const document = await pdfjs.getDocument({ data: new Uint8Array(fixture), ...pdfDocumentOptions }).promise;
  const rendered = await renderPdfPage(await document.getPage(1));
  assert.equal(rendered.buffer.subarray(1, 4).toString('ascii'), 'PNG');
  const catalogue = await extractPdfCatalogue(fixture);
  assert.equal(catalogue.pageCount, 1);
  assert.equal(catalogue.nativeTextFound, true);
  assert.equal(catalogue.products.length, 1);
  assert.equal(catalogue.products[0].sku, '50101');
  assert.equal(catalogue.products[0].name, 'TRIVO LED BULB');
  assert.equal(catalogue.products[0].mrp, '999');
  assert.equal(catalogue.products[0].source, 'native');
});

test('associates separate embedded photographs to the closest SKU sections on one page', async () => {
  const catalogue = await extractPdfCatalogue(makeMultiProductPdf());
  assert.deepEqual(catalogue.products.map((product) => product.sku), ['A001', 'B002']);
  assert.equal(catalogue.images.length, 2);
  assert.deepEqual(catalogue.images.map((image) => image.skus), [['A001'], ['B002']]);
  assert.equal(catalogue.images.some((image) => image.needsReview), false);
});

test('marks products with page images but no plausible photo candidate as extraction failures', async () => {
  const catalogue = await extractPdfCatalogue(makeMultiProductPdf([40, 20]));
  assert.equal(catalogue.products.every((product) => product.imageStatus === 'extraction-failed'), true);
});

test('recovers a black-finish row from its matching white-finish description and decimal MRP', async () => {
  const catalogue = await extractPdfCatalogue(makePdf([
    '55301-WH Trivo 20A Touch Switch 2749.00 10',
    '55301-BK 2892.00 10',
  ]));
  assert.equal(catalogue.products.length, 1);
  assert.equal(catalogue.products[0].sku, '55301-BK');
  assert.equal(catalogue.products[0].name, 'Trivo 20A Touch Switch');
  assert.equal(catalogue.products[0].mrp, '2892.00');
});

test('preserves full hyphenated SKUs and uses a product heading instead of an upcoming banner', async () => {
  const catalogue = await extractPdfCatalogue(makePdf([
    'CARINO FULL (GLOW) DIFFUSER DOWN LIGHT (DOB)',
    'WATTAGE PRODUCT CODE CCT DIMENSION CASE LOT MAXIMUM RETAIL PRICE',
    'WATTAGE',
    'PRODUCT CODE',
    'CCT DIMENSION',
    'CASE LOT PRICE',
    'UPCOMING',
    '9W LED-091-FD-DDL 6000K 400.00',
  ]));
  assert.equal(catalogue.products.length, 1);
  assert.equal(catalogue.products[0].sku, 'LED-091-FD-DDL');
  assert.equal(catalogue.products[0].name, 'CARINO FULL (GLOW) DIFFUSER DOWN LIGHT (DOB)');
});

test('skips a blank landscape scan without starting OCR', async () => {
  const landscapePdf = makePdf([]).toString('latin1').replace('/MediaBox [0 0 612 792]', '/MediaBox [0 0 792 612]');
  const catalogue = await extractPdfCatalogue(Buffer.from(landscapePdf, 'latin1'));
  assert.equal(catalogue.pages[0].source, 'skipped');
  assert.equal(catalogue.pages[0].timingsMs.ocr, 0);
  assert.equal(catalogue.products.length, 0);
});

test('reconstructs only consensus SKUs from a colour/module matrix', () => {
  const word = (text, x, y) => ({ text, bbox: { x0: x, x1: x + 24, y0: y, y1: y + 12 } });
  const rows = [
    word('SOLO', 450, 20), word('PLATE', 490, 20),
    word('MODULE', 450, 60), word('1M', 520, 60), word('2M', 580, 60), word('3M', 640, 60),
    word('WHITE', 450, 90), word('20501-WH', 520, 90), word('20502-WH', 580, 90), word('20503-WH', 640, 90),
    word('MRP', 450, 120), word('84.00', 520, 120), word('101.00', 580, 120), word('118.00', 640, 120),
    word('PKG', 450, 150), word('20', 520, 150), word('20', 580, 150), word('20', 640, 150),
    // One OCR-corrupted cell must not become a made-up fourth product.
    word('WHITE', 450, 180), word('20504-WBO-X', 520, 180), word('20505-WH', 580, 180),
  ];
  const result = reconstructCatalogueMatrices(rows, { pageNumber: 7, sourceScale: 2 });
  assert.deepEqual(result.map((entry) => entry.sku), ['20501-WH', '20502-WH', '20503-WH']);
  assert.equal(result[0].name, 'SOLO PLATE - WHITE - 1M');
  assert.equal(result[0].mrp, '84.00');
});
