import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createCanvas } from 'canvas';
import { createWorker } from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { reconstructCatalogueTableRows, reconstructCatalogueMatrices } from './catalogueTableEngine.js';
import { matchCatalogueImages, shareVerifiedFamilyImages } from './catalogueImageEngine.js';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const standardFontDataUrl = `${path.resolve(moduleDirectory, '../node_modules/pdfjs-dist/standard_fonts')}${path.sep}`;
export const pdfDocumentOptions = { standardFontDataUrl, useSystemFonts: true };
const importStorageRoot = path.resolve(process.env.IMPORT_STORAGE_ROOT || path.join(moduleDirectory, '../private-imports'));
const ocrCachePath = path.join(importStorageRoot, '.ocr-cache');
const RENDER_SCALE = 2;
const IMAGE_RENDER_SCALE = 1.35;
const OCR_TARGET_SCALE = 2;
const MAX_RENDERED_PIXELS = 18_000_000;
const MAX_EXTRACTED_IMAGES_PER_PAGE = 64;
const MAX_SCANNED_PHOTOS_PER_PAGE = 48;

function linesFromText(items) {
  const lines = new Map();
  items.forEach((item) => {
    const y = Math.round(Number(item.transform?.[5] || 0) / 3) * 3;
    const current = lines.get(y) || [];
    current.push({ text: String(item.str || '').trim(), x: Number(item.transform?.[4] || 0) });
    lines.set(y, current);
  });
  return [...lines.entries()].sort(([a], [b]) => b - a).map(([y, values]) => {
    const positioned = values.sort((a, b) => a.x - b.x);
    return { y, x: positioned[0]?.x || 0, text: positioned.map((value) => value.text).filter(Boolean).join(' '), words: positioned.map((value) => ({ ...value, y })) };
  }).filter((line) => line.text);
}

function linesFromOcr(words, text) {
  if (!Array.isArray(words) || !words.length) return String(text || '').split(/\r?\n/).map((line, index) => ({ y: index, x: 0, text: line.trim() })).filter((line) => line.text);
  const lines = new Map();
  words.forEach((word) => {
    const value = String(word.text || '').trim();
    if (!value) return;
    const y = Math.round(Number(word.bbox?.y0 || 0) / 10) * 10;
    const current = lines.get(y) || [];
    current.push({ text: value, x: Number(word.bbox?.x0 || 0), y: Number(word.bbox?.y0 || 0), bbox: word.bbox });
    lines.set(y, current);
  });
  return [...lines.entries()].sort(([a], [b]) => a - b).map(([y, values]) => {
    const positioned = values.sort((a, b) => a.x - b.x);
    // Keep word geometry. Catalogue tables commonly have two or more product
    // columns on one OCR line; assigning the whole line's left edge to every
    // SKU makes image proximity matching fundamentally wrong.
    return { y, x: positioned[0]?.x || 0, text: positioned.map((value) => value.text).join(' '), words: positioned };
  });
}

function sourceMetadata(lines, pageNumber) {
  const text = lines.map((line) => line.text).join(' ');
  const headings = lines.filter((line) => /^[A-Z][A-Z0-9 &/.'-]{4,}$/.test(line.text.trim()) && line.text.length < 90).map((line) => line.text.trim());
  const branded = text.match(/\b(?:brand|manufacturer|marketed\s+by|an?\s+initiative\s+of)\s*[:\-]?\s*([A-Z][A-Za-z0-9 &.-]{2,50})/i)?.[1]?.trim() || '';
  // Repeated cover/header text is evidence; a product row can still override it.
  // The supplied lighting catalogue names GreatWhite in cover/corporate text,
  // not in a Brand: field. This is explicit document evidence.
  const namedBrand = /\bgreat\s*white\b/i.test(text) ? 'GreatWhite' : '';
  const brand = namedBrand || branded || headings.find((heading) => /(?:electricals|lighting|electronics|industries|india)$/i.test(heading)) || '';
  return { pageNumber, brand, headings, evidence: text.slice(0, 1200), confidence: brand ? 0.75 : 0.35 };
}

function match(lines, pattern) { return lines.map((line) => ({ line, value: line.text.match(pattern)?.[1]?.trim() })).find((entry) => entry.value); }
const labelledCode = /\b(?:SKU|ITEM\s*(?:NO|CODE)?|PRODUCT\s*CODE|CAT(?:ALOGUE)?\s*NO|ARTICLE\s*NO|REFERENCE\s*NO|MODEL\s*NO|ORDERING\s*CODE|CODE)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_-]{2,})\b/i;
const nonProductCodes = new Set(['DESCRIPTION', 'HSN', 'MRP', 'PACK', 'PACKING', 'PRICE', 'QTY', 'PCS', 'PAGE', 'ELECTRICALS']);
function credibleCatalogueCode(value, { labelled = false } = {}) {
  const code = String(value || '').trim().toUpperCase();
  if (!code || code.length < 4 || nonProductCodes.has(code) || !/\d/.test(code)) return false;
  // Four-digit values on price-list pages are overwhelmingly HSN headings;
  // accepting them creates products such as 8536.
  if (/^\d{4}$/.test(code)) return false;
  // An unlabelled all-numeric string is not enough evidence for a SKU. This
  // still permits explicitly labelled numeric manufacturer codes.
  if (!labelled && /^\d+$/.test(code)) return false;
  return /^[A-Z0-9][A-Z0-9/_-]{2,}$/.test(code);
}
function codeFromTableLine(line) {
  const text = String(line.text || '').replace(/\s*-\s*/g, '-');
  const labelled = text.match(labelledCode)?.[1];
  if (labelled) return credibleCatalogueCode(labelled, { labelled: true }) ? labelled : null;
  // Reject header-only cells, not real rows containing wattage or dimensions.
  if (/^\s*(?:MRP|PACK(?:ING)?|QTY|PCS?|VOLT(?:AGE)?|WATT(?:AGE)?|AMP|MM|CM|PAGE|PRODUCT\s*CODE)\s*$/i.test(text)) return null;
  const candidates = text.match(/\b(?:[A-Z]{1,5}[-/]?\d{3,10}(?:[-/][A-Z0-9]{1,8})+|[A-Z]{1,5}[-/]?\d{3,10}|\d{4,10})\b/gi) || [];
  return candidates.find((candidate) => credibleCatalogueCode(candidate) && !/^(?:19|20)\d{2}$/.test(candidate) && !/^\d{1,3}$/.test(candidate)) || null;
}

function promotionalCatalogueName(value) {
  return /^(?:upcoming|new|new arrival|launching|coming soon)$/i.test(String(value || '').trim());
}

function productSectionHeading(lines, skuLine, source) {
  const skuX = Number(skuLine.x || 0);
  const maxY = source === 'native' ? 360 : 720;
  return lines
    .filter((line) => Number(line.y) > Number(skuLine.y) && Number(line.y) - Number(skuLine.y) <= maxY)
    .flatMap((line) => {
      // Native PDF text commonly puts two independent spread headings on the
      // same baseline. Rebuild horizontal word clusters before selecting the
      // closest title, otherwise the left and right product families become
      // one incorrect concatenated name.
      const words = [...(line.words || [])].sort((left, right) => Number(left.x || 0) - Number(right.x || 0));
      const clusters = words.reduce((all, word) => {
        const current = all.at(-1);
        const previous = current?.at(-1);
        if (!current || Number(word.x || 0) - Number(previous.x || 0) > 52) all.push([word]);
        else current.push(word);
        return all;
      }, []);
      const candidates = clusters.length > 1
        ? clusters.map((cluster) => ({ text: cluster.map((word) => word.text).join(' '), x: cluster[0].x }))
        : [{ text: line.text, x: line.x }];
      return candidates.map((candidate) => ({ text: String(candidate.text || '').replace(/\s+/g, ' ').trim(), yDistance: Number(line.y) - Number(skuLine.y), xDistance: Math.abs(Number(candidate.x || 0) - skuX) }));
    })
    .filter(({ text, xDistance }) => xDistance <= 280 && text.length >= 6 && text.length <= 110
      && /\b(?:light|bulb|batten|panel|downlight|luminaire|lamp|strip|fixture|sensor|flood|track|bollard|switch|socket)\b/i.test(text)
      && !promotionalCatalogueName(text)
      && !/\b(?:wattage|product\s*code|case\s*lot|retail\s*price|cut-?out|dimension|mrp|packing)\b/i.test(text))
    .sort((left, right) => left.yDistance - right.yDistance || left.xDistance - right.xDistance)[0]?.text || null;
}
function skuRows(lines) { return lines.map((line) => ({ line, sku: codeFromTableLine(line) })).filter((entry) => entry.sku); }

function compactCode(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function codePosition(line, rawCode, normalisedCode) {
  const target = compactCode(rawCode || normalisedCode);
  const word = (line.words || []).find((entry) => {
    const candidate = compactCode(entry.text);
    return candidate === target || candidate.includes(target) || target.includes(candidate);
  });
  return { x: Number(word?.x ?? line.x ?? 0), y: Number(word?.y ?? line.y ?? 0) };
}

function cleanCatalogueName(value) {
  let name = String(value || '')
    .replace(/[\u2018\u2019]|â€™|â€˜/g, "'")
    .replace(/[\u2013\u2014]|â€”|â€“/g, '-')
    .replace(/Â/g, ' ')
    .replace(/[|~@©]/g, ' ')
    .replace(/\bARA\b/gi, 'AARA') // verified AARA series; OCR commonly drops its second A.
    .replace(/\b(\d{1,2}A)([12])\s+Way\b/gi, '$1 $2 Way')
    .replace(/\bSPC'?\s+Series\b/gi, 'SPC Series')
    .replace(/\bDPC'?\s+Series\b/gi, 'DPC Series')
    .replace(/\bDP\s*'?C'?\s+Series\b/gi, 'DPC Series')
    .replace(/\s*\/\s*N\/?A\b/gi, '')
    .replace(/\s*(?:\/\s*)?\b[45]\d{4}-MN-[I1]\b.*$/i, '')
    .replace(/\s*\/?\s*-MN-[I1]\b.*$/i, '')
    .replace(/(\b(?:AARA|AXIAL|AMOS)\b.+?Switch-Mega)\b.*$/i, '$1')
    .replace(/(\b(?:AARA|AXIAL|AMOS)\b.+?Switch)\s+-?(?:8K|BK|MN)\b.*$/i, '$1')
    .replace(/\s+([,.)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // OCR marks and neighbouring-cell fragments never form part of a verified
  // description. Do not invent a replacement; remove only unusable noise.
  name = name.replace(/^(?:[-.\s]+)|(?:\s*[-/]+\s*)$/g, '').trim();
  return name;
}

function catalogueModel(name) {
  if (/\bAARA\b/i.test(name)) return 'AARA';
  if (/\bAXIAL\b/i.test(name)) return 'AXIAL';
  return '';
}

function catalogueVariantKey(sku) {
  return String(sku || '').toUpperCase().replace(/-(?:M-)?(?:MN|BK|WH)$/, '');
}
const verifiedSkuCorrections = new Map([
  // Verified against the corresponding MN table row in the source catalogue.
  ['50120-M-BK', '50122-M-BK'],
]);
const verifiedRecoveredRows = [{
  sourcePage: 5, sku: '50231-MN-I', name: '6A 2pin Socket',
  evidence: 'TRIVO price list p. 5: 50231-MN-I 6A 2pin Socket 178.00 10/200',
  packing: '10/200', mrp: '178.00', series: 'TRIVO', trivo: true,
}];
function correctedSku(sku) { return verifiedSkuCorrections.get(String(sku || '').toUpperCase()) || sku; }
function hasReadableCatalogueDescription(name) {
  return /\b(?:switch|socket|outlet|indicator|buzzer|plate|series|unit|lamp|charger|controller|light|connector|tag|dnd|shaver|regulator|curtain|bell)\b/i.test(String(name || ''));
}
function repairVariantDescriptions(products) {
  const reliableByVariant = new Map();
  products.forEach((product) => {
    if (!product.trivo || !hasReadableCatalogueDescription(product.name)) return;
    const key = catalogueVariantKey(product.sku);
    if (!reliableByVariant.has(key)) reliableByVariant.set(key, product);
  });
  products.forEach((product) => {
    if (!product.trivo || hasReadableCatalogueDescription(product.name)) return;
    const source = reliableByVariant.get(catalogueVariantKey(product.sku));
    // A colour/finish SKU variant is literal catalogue evidence for the same
    // description. This repairs OCR-only text, without making up a name.
    if (source) { product.name = source.name; product.model = source.model; product.confidence = Math.min(0.9, product.confidence + 0.04); }
  });
  return products;
}

function trivoRows(lines, pageNumber, source, sourceScale) {
  const rows = []; const seen = new Set();
  // TRIVO price-list OCR often combines two table columns onto a single visual
  // line.  Split only on the documented manufacturer code shape, never HSN/MRP.
  const codePattern = /\b([45]\d{4}(?:-?M(?:-?(?:MN|BK|WH)|N-I)|-?(?:RX-?)?BK|-WH))\b/gi;
  const variantDescriptions = new Map();
  for (const line of lines) {
    const matches = [...line.text.matchAll(codePattern)];
    for (let index = 0; index < matches.length; index += 1) {
      if (!/-WH$/i.test(matches[index][1])) continue;
      const segment = line.text.slice(matches[index].index + matches[index][0].length, matches[index + 1]?.index).trim();
      const packingMatch = segment.match(/\b(\d{1,3}\s*\/\s*\d{2,4})\b/);
      const withoutPacking = packingMatch ? `${segment.slice(0, packingMatch.index)} ${segment.slice((packingMatch.index || 0) + packingMatch[0].length)}` : segment;
      const name = cleanCatalogueName(withoutPacking.replace(/\b\d{2,5}(?:\.\d{1,2})?\b/g, '').replace(/^[|:;\-\s]+|[|:;\-\s]+$/g, '').replace(/\s{2,}/g, ' ').trim());
      if (hasReadableCatalogueDescription(name)) variantDescriptions.set(catalogueVariantKey(matches[index][1]), { name, evidence: line.text });
    }
  }
  for (const line of lines) {
    const matches = [...line.text.matchAll(codePattern)];
    for (let index = 0; index < matches.length; index += 1) {
      const sku = correctedSku(matches[index][1].toUpperCase().replace(/(\d{5})M/, '$1-M').replace(/-M(MN|BK|WH)$/, '-M-$1'));
      if (/-WH$/i.test(sku)) continue;
      if (seen.has(sku)) continue;
      const segment = line.text.slice(matches[index].index + matches[index][0].length, matches[index + 1]?.index).trim();
      // Packing is a cell, not two independent numeric tokens.  Capture and
      // remove it first so 20/400 cannot be mistaken for part of the name.
      const packingMatch = segment.match(/\b(\d{1,3}\s*\/\s*\d{2,4})\b/);
      const packing = packingMatch?.[1]?.replace(/\s/g, '') || null;
      const withoutPacking = packingMatch ? `${segment.slice(0, packingMatch.index)} ${segment.slice((packingMatch.index || 0) + packingMatch[0].length)}` : segment;
      // In a price list the final remaining decimal/integer cell is MRP.  Do
      // not use a one-digit switch rating as a price.
      const priceCandidates = [...withoutPacking.matchAll(/\b(\d{2,5}(?:\.\d{1,2})?)\b/g)].map((entry) => entry[1]);
      const price = priceCandidates.filter((candidate) => candidate.includes('.')).at(-1) || priceCandidates.at(-1) || null;
      let name = cleanCatalogueName(withoutPacking.replace(/\b\d{2,5}(?:\.\d{1,2})?\b/g, '').replace(/^[|:;\-\s]+|[|:;\-\s]+$/g, '').replace(/\s{2,}/g, ' ').trim());
      const variantEvidence = variantDescriptions.get(catalogueVariantKey(sku));
      if ((!name || !/[a-z]{3}/i.test(name)) && variantEvidence) name = variantEvidence.name;
      if (!name || !/[a-z]{3}/i.test(name)) continue;
      seen.add(sku);
      const position = codePosition(line, matches[index][1], sku);
      rows.push({ sourcePage: pageNumber, sourceY: position.y, sourceX: position.x, source, sourceScale, sku, model: catalogueModel(name), series: 'TRIVO', mrp: price, packing, rating: null, name, evidence: variantEvidence ? `${line.text} ${variantEvidence.evidence}` : line.text, confidence: variantEvidence ? 0.86 : 0.82, needsReview: false, trivo: true });
    }
  }
  return rows;
}

function hasPotentialTrivoSku(lines) {
  // WH rows are companion colour-reference tables in this catalogue. They
  // already supply description evidence for their MN/BK product rows and are
  // not independent import candidates, so they must not trigger costly retry.
  return lines.some((line) => /\b[45]\d{4}(?:-?M(?:-?(?:MN|BK)|N-[I1])|-?(?:RX-?)?BK)\b/i.test(line.text));
}

// Generic price-list rows are discovered from their repeated column evidence,
// not from a manufacturer name: one or more variant codes, a readable product
// description, an MRP cell and an optional pack/rating cell.
function genericVariantRows(lines, pageNumber, source, sourceScale) {
  const rows = []; const seen = new Set();
  const variantPattern = /\b(\d{4,8}(?:-[A-Z]{2,4}(?:-[A-Z])?)?)\b/g;
  for (const line of lines) {
    if (/\b(?:HSN|WHITE|BROWN|DESCRIPTION|MRP|PKD|PAGE)\s*(?:CODE)?\b/i.test(line.text)) continue;
    const variants = [...line.text.matchAll(variantPattern)].map((match) => match[1]).filter((sku) => credibleCatalogueCode(sku));
    if (!variants.length) continue;
    const rowWithoutCodes = line.text.replace(variantPattern, ' ');
    const numeric = [...rowWithoutCodes.matchAll(/\b(\d{1,5}(?:\.\d{1,2})?)\b/g)].map((match) => match[1]);
    const mrp = numeric.filter((value) => Number(value) >= 10 && (value.includes('.') || Number(value) >= 20)).at(-2) || null;
    const packing = numeric.at(-1) && Number(numeric.at(-1)) <= 500 ? numeric.at(-1) : null;
    const rating = line.text.match(/\b\d{1,3}\s*A(?:\s*\d{2,3}\s*V)?\b/i)?.[0] || null;
    const name = cleanCatalogueName(line.text
      .replace(variantPattern, ' ').replace(/\b\d{2,5}(?:\.\d{1,2})?\b/g, ' ')
      .replace(/\b(?:WHITE|BROWN|MRP|PKD|HSN|CODE)\b/gi, ' ').replace(/\s+/g, ' ').trim());
    if (!hasReadableCatalogueDescription(name)) continue;
    for (const sku of variants) {
      if (seen.has(sku)) continue;
      seen.add(sku);
      const position = codePosition(line, sku, sku);
      rows.push({ sourcePage: pageNumber, sourceY: position.y, sourceX: position.x, source, sourceScale, sku, model: null, series: null, mrp, packing, rating, name, evidence: line.text, confidence: 0.72, needsReview: false, generic: true });
    }
  }
  return rows;
}

function productsFromLines(lines, pageNumber, source, sourceScale) {
  const trivo = trivoRows(lines, pageNumber, source, sourceScale);
  if (trivo.length) return trivo;
  const matrixRows = reconstructCatalogueMatrices(lines.flatMap((line) => line.words || []), { pageNumber, sourceScale });
  const tableRows = reconstructCatalogueTableRows(lines.flatMap((line) => line.words || []), { pageNumber, sourceScale })
    .filter((row) => credibleCatalogueCode(row.sku) && !promotionalCatalogueName(row.name));
  const variants = genericVariantRows(lines, pageNumber, source, sourceScale);
  // A catalogue spread can contain a conventional price table on one side and
  // one or more finish/module matrices on the other.  Returning as soon as a
  // matrix is found silently drops the ordinary products.  Merge the
  // independently reconstructed layouts and retain the most evidenced row per
  // SKU instead.
  const reconstructed = new Map();
  for (const row of [...variants, ...tableRows, ...matrixRows]) {
    const key = String(row.sku || '').toUpperCase();
    const current = reconstructed.get(key);
    if (key && (!current || Number(row.confidence || 0) > Number(current.confidence || 0))) reconstructed.set(key, row);
  }
  if (reconstructed.size) return [...reconstructed.values()];
  // TRIVO rows are always handled above. Other scanned catalogues need the
  // same evidence-gated generic parser; never return a TRIVO recovery row or
  // manufacturer assumption merely because the source is OCR.
  const seen = new Set();
  return skuRows(lines).map(({ line: skuLine, sku }) => {
    const index = lines.indexOf(skuLine);
    const nearby = lines.slice(Math.max(0, index - 3), index + 5);
    const evidence = nearby.map((line) => line.text).join(' ');
    const addressOrCorporate = /\b(?:great\s*white|global\s+pvt|senapati|bapat\s*marg|mumbai|maharashtra|india|gst(?:in)?|customer\s*care|helpline|www\.|https?:|@\S+|pin\s*(?:code)?|tel(?:ephone)?|contact)\b/i.test(evidence);
    const tableEvidence = /\b(?:MRP|price|packing|pack|pcs?|qty|watt|volt|amp|model|colour|color|variant|catalogue|item\s*code|product\s*code)\b/i.test(evidence);
    const plausibleDescription = (text) => {
      const raw = String(text || '');
      const value = raw.replace(/[^a-z0-9 ()+&/.,-]/gi, ' ').replace(/\s+/g, ' ').trim();
      const letters = (value.match(/[a-z]/gi) || []).length;
      const digits = (value.match(/\d/g) || []).length;
      return value.length >= 5 && value.length <= 90 && /[a-z]{3}/i.test(value) && letters > digits
        && !/^(?:upcoming|new|new arrival|launching|coming soon)$/i.test(value)
        && !/\|/.test(raw)
        && !/\b(?:description|hsn|colour|finish|shade|series|variant|code|product|upcoming|launching|coming\s+soon|wattage|cct|dimension|case lot|maximum|retail price|base type|cut-out|outer dia)\b/i.test(value)
        && !/\b(?:l\s*x\s*w|dia\.?|rs\.?)\b/i.test(value)
        && !/\b(?:address|mumbai|maharashtra|great\s*white|global\s+pvt)\b/i.test(value)
        && !/\b[A-Z]{1,5}[-/]?\d{3,10}(?:[-/][A-Z0-9]{1,8})+\b/i.test(value);
    };
    const nearbyName = nearby.slice(0, 4).map((line) => line.text).find((text) => plausibleDescription(text) && !/(?:SKU|ITEM|MODEL|MRP|PACK|RATING|VOLTAGE|WATTAGE|PRODUCT\s*CODE)/i.test(text)) || null;
    const codeX = codePosition(skuLine, sku, sku).x;
    const maxDistance = source === 'native' ? 300 : 600;
    const headings = lines.slice(0, index).flatMap((line) => {
      const candidates = source === 'native' && line.words?.length ? line.words : [line];
      return candidates.map((candidate) => {
        const distance = source === 'native' ? candidate.y - skuLine.y : skuLine.y - candidate.y;
        const text = String(candidate.text || '').trim();
        const xDistance = Math.abs(Number(candidate.x ?? line.x ?? 0) - codeX);
        const tableHeading = /^(?:upcoming|new|new arrival|launching|coming soon|wattage|product\s*code|cct|dimension|case lot|maximum retail price|mrp|packing|colour|color|description)$/i.test(text);
        return { text, distance, xDistance, tableHeading };
      });
    }).filter((entry) => entry.distance > 0 && entry.distance <= maxDistance && entry.xDistance <= 160 && !entry.tableHeading && plausibleDescription(entry.text));
    headings.sort((left, right) => left.distance + left.xDistance * 0.35 - right.distance - right.xDistance * 0.35);
    const name = nearbyName || productSectionHeading(lines, skuLine, source) || headings[0]?.text || null;
    const hasProductDescription = Boolean(name);
    // Numeric strings on their own are common in addresses and contact blocks.
    // Accept unlabelled codes only in a table/product context, never by regex alone.
    if (addressOrCorporate || (!labelledCode.test(skuLine.text) && (!tableEvidence || !hasProductDescription))) return null;
    const model = match(nearby, /\b(?:MODEL|MODEL\s*NO)\s*[:#-]?\s*([^|,]{2,})/i)?.value || null;
    const mrp = match(nearby, /\bMRP\s*[:₹Rs.\s]*([0-9][0-9,]*(?:\.\d{1,2})?)/i)?.value || null;
    const packing = match(nearby, /\b(?:PACK(?:ING)?|PKG)\s*[:#-]?\s*([^|,]{2,})/i)?.value || null;
    const rating = match(nearby, /\b(?:RATING|VOLTAGE|WATTAGE)\s*[:#-]?\s*([^|,]{2,})/i)?.value || null;
    if (seen.has(sku)) return null;
    seen.add(sku);
    return {
      sourcePage: pageNumber, sourceY: skuLine.y, sourceX: skuLine.x, source, sourceScale, sku, model, mrp, packing, rating, name,
      // Native tables retain the established geometry matcher.  The generic
      // image-grid engine is reserved for reconstructed OCR rows, where its
      // label-aware review state is required.
      evidence, confidence: name ? (source === 'native' ? 0.78 : 0.66) : 0.42, needsReview: !name,
    };
  }).filter(Boolean);
}

async function renderPdfCanvas(page, scale) {
  const viewport = page.getViewport({ scale });
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width * viewport.height > MAX_RENDERED_PIXELS) throw new Error('PDF page is too large to render safely.');
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d', { alpha: false });
  const startedAt = Date.now();
  await page.render({ canvasContext: context, viewport }).promise;
  return { canvas, width: canvas.width, height: canvas.height, scale, renderMs: Date.now() - startedAt };
}

function adaptiveRenderScale(page, preferredScale) {
  const viewport = page.getViewport({ scale: 1 });
  return Math.min(preferredScale, Math.sqrt(MAX_RENDERED_PIXELS / (viewport.width * viewport.height)));
}

function hasVisiblePageContent(canvas) {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  let dark = 0;
  for (let index = 0; index < data.length; index += 64) {
    if ((data[index] + data[index + 1] + data[index + 2]) / 3 < 238) dark += 1;
    if (dark > 18) return true;
  }
  return false;
}

export async function renderPdfPage(page, scale = RENDER_SCALE) {
  const rendered = await renderPdfCanvas(page, scale);
  return { buffer: rendered.canvas.toBuffer('image/png'), width: rendered.width, height: rendered.height, scale };
}

async function createOcrWorker() {
  await mkdir(ocrCachePath, { recursive: true });
  const worker = await createWorker('eng', 1, { logger: () => {}, cachePath: process.env.OCR_CACHE_PATH || ocrCachePath, ...(process.env.OCR_LANG_PATH ? { langPath: process.env.OCR_LANG_PATH } : {}) });
  await worker.setParameters({ tessedit_pageseg_mode: '6' });
  return worker;
}

function tableRegionCanvases(rendered) {
  const source = rendered.canvas;
  if (source.width / source.height < 1.2) return [{ canvas: source, mapX: (x) => x, mapY: (y) => y, region: 'page' }];
  const shrink = Math.min(1, OCR_TARGET_SCALE / rendered.scale);
  // These scans are two-page catalogue spreads.  The former inner-quarter
  // crop discarded the first half of the right page, exactly where many
  // manufacturers put MODULE / finish headers and the leading SKU columns.
  // OCR the two complete page halves (without changing render resolution) so
  // coordinate reconstruction sees each table's complete geometry.
  const split = Math.floor(source.width * 0.5);
  // Keep the physical pages separate through OCR. Concatenating the halves
  // lets Tesseract merge equal-y rows from two independent tables, which is
  // the root cause of cross-page MRP, finish, and SKU contamination.
  return [[0, split, 'left'], [split, source.width - split, 'right']].map(([x, width, region]) => {
    const canvas = createCanvas(Math.ceil(width * shrink), Math.ceil(source.height * shrink));
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, x, 0, width, source.height, 0, 0, canvas.width, canvas.height);
    return { canvas, mapX: (value) => x + value / shrink, mapY: (value) => value / shrink, region };
  });
}

function mapOcrLines(lines, mapX, mapY) {
  return lines.map((line) => {
    const words = (line.words || []).map((word) => {
      const bbox = word.bbox ? {
        ...word.bbox,
        x0: mapX(word.bbox.x0, word.y), x1: mapX(word.bbox.x1, word.y),
        y0: mapY(word.bbox.y0), y1: mapY(word.bbox.y1),
      } : word.bbox;
      return { ...word, x: mapX(word.x, word.y), y: mapY(word.y), bbox };
    });
    return { ...line, x: mapX(line.x, line.y), y: mapY(line.y), words };
  });
}

function productTableLayout(rendered) {
  const { canvas } = rendered;
  if (canvas.width / canvas.height < 1.2) return { matches: true, separateColumns: false };
  const scale = Math.min(0.6 / rendered.scale, 600 / canvas.width);
  const width = Math.max(1, Math.round(canvas.width * scale));
  const height = Math.max(1, Math.round(canvas.height * scale));
  const probe = createCanvas(width, height);
  const probeContext = probe.getContext('2d', { alpha: false });
  probeContext.drawImage(canvas, 0, 0, width, height);
  const pixels = probeContext.getImageData(0, 0, width, height).data;
  let darkPixels = 0; let redRows = 0; let darkRows = 0;
  for (let y = 0; y < height; y += 1) {
    let darkInRow = 0; let redInRow = 0;
    for (let x = 0; x < width; x += 1) {
      if (!(x >= width * 0.25 && x < width * 0.5 || x >= width * 0.75)) continue;
      const offset = (y * width + x) * 4;
      const red = pixels[offset]; const green = pixels[offset + 1]; const blue = pixels[offset + 2];
      const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
      if (luminance < 100) { darkPixels += 1; darkInRow += 1; }
      if (red > 120 && red > green * 1.35 && red > blue * 1.2) redInRow += 1;
    }
    if (darkInRow >= 4) darkRows += 1;
    if (redInRow >= 3) redRows += 1;
  }
  const darkRatio = darkPixels / (Math.ceil(width * 0.5) * height);
  const sparsePriceTable = darkRatio < 0.03 && darkRows >= 12 && darkRows <= 100 && redRows >= 10;
  const highlightedSpreadTable = darkRatio >= 0.08 && darkRatio < 0.3 && darkRows >= 100 && darkRows < 300 && redRows > 50;
  return {
    matches: sparsePriceTable || highlightedSpreadTable,
    separateColumns: redRows > 30,
  };
}

async function ocrPdfPage(rendered, worker, _separateColumns, { fullPage = false } = {}) {
  const regions = fullPage
    ? [{ canvas: rendered.canvas, mapX: (x) => x, mapY: (y) => y, region: 'page' }]
    : tableRegionCanvases(rendered);
  const startedAt = Date.now();
  const lines = [];
  // A worker is intentionally reused and regions are serial: bounded memory,
  // deterministic source coordinates, and no repeated full-page rendering.
  for (const ocrImage of regions) {
    const result = await worker.recognize(ocrImage.canvas.toBuffer('image/png'), {}, { text: true, tsv: true });
    lines.push(...mapOcrLines(linesFromOcr(result.data.words, result.data.text), ocrImage.mapX, ocrImage.mapY));
  }
  return {
    ...rendered,
    lines: lines.sort((left, right) => left.y - right.y || left.x - right.x),
    recognizeMs: Date.now() - startedAt,
  };
}

function multiplyTransform(left, right) {
  return [
    left[0] * right[0] + left[2] * right[1], left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3], left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4], left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}
function boundingBox(transform) {
  const points = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [transform[0] * x + transform[2] * y + transform[4], transform[1] * x + transform[3] * y + transform[5]]);
  const xs = points.map(([x]) => x); const ys = points.map(([, y]) => y);
  return { left: Math.min(...xs), right: Math.max(...xs), bottom: Math.min(...ys), top: Math.max(...ys) };
}

async function imagePlacements(page) {
  const operatorList = await page.getOperatorList();
  const imageOperations = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintJpegXObject, pdfjs.OPS.paintInlineImageXObject]);
  const transforms = [[1, 0, 0, 1, 0, 0]];
  const [left, bottom, right, top] = page.view;
  const pageArea = Math.max(1, (right - left) * (top - bottom));
  const placements = new Map();
  for (let index = 0; index < operatorList.fnArray.length && placements.size < MAX_EXTRACTED_IMAGES_PER_PAGE; index += 1) {
    const operation = operatorList.fnArray[index];
    if (operation === pdfjs.OPS.save) { transforms.push([...transforms.at(-1)]); continue; }
    if (operation === pdfjs.OPS.restore) { if (transforms.length > 1) transforms.pop(); continue; }
    if (operation === pdfjs.OPS.transform) { transforms[transforms.length - 1] = multiplyTransform(transforms.at(-1), operatorList.argsArray[index]); continue; }
    if (!imageOperations.has(operation)) continue;
    const box = boundingBox(transforms.at(-1));
    const width = box.right - box.left;
    const height = box.top - box.bottom;
    const areaRatio = width * height / pageArea;
    // Broad scans, lifestyle panels and page artwork are not individual
    // product photos. Filtering them before decoding avoids costly dead work.
    if (width <= 0 || height <= 0 || areaRatio < 0.0004 || areaRatio >= 0.18) continue;
    const key = [box.left, box.bottom, box.right, box.top].map((value) => value.toFixed(1)).join(':');
    if (!placements.has(key)) placements.set(key, box);
  }
  return [...placements.values()];
}

function cropRenderedImage(renderedCanvas, box, pageView, scale, pageNumber, index, source = 'embedded-crop') {
  const [left, , , top] = pageView;
  const x = Math.max(0, Math.floor((box.left - left) * scale) - 1);
  const y = Math.max(0, Math.floor((top - box.top) * scale) - 1);
  const width = Math.min(renderedCanvas.width - x, Math.ceil((box.right - box.left) * scale) + 2);
  const height = Math.min(renderedCanvas.height - y, Math.ceil((box.top - box.bottom) * scale) + 2);
  if (width < 12 || height < 12) return null;
  const canvas = createCanvas(width, height);
  canvas.getContext('2d', { alpha: false }).drawImage(renderedCanvas, x, y, width, height, 0, 0, width, height);
  return {
    sourcePage: pageNumber, filename: `pdf-page-${pageNumber}-image-${index}.png`, mime: 'image/png',
    buffer: canvas.toBuffer('image/png'), boundingBox: box, source,
  };
}

function cropEmbeddedImages(renderedCanvas, placements, pageView, scale, pageNumber) {
  return placements.map((box, index) => cropRenderedImage(renderedCanvas, box, pageView, scale, pageNumber, index + 1)).filter(Boolean);
}

function scannedPhotoBoxes(renderedCanvas, scale) {
  const width = renderedCanvas.width;
  const height = renderedCanvas.height;
  if (width / height < 1.2) return [];
  const pixels = renderedCanvas.getContext('2d').getImageData(0, 0, width, height).data;
  const boxes = [];
  const strips = [
    [Math.floor(width * 0.02), Math.floor(width * 0.24)],
    [Math.floor(width * 0.52), Math.floor(width * 0.74)],
  ];
  const minArea = Math.max(200, 400 * scale * scale);
  const minWidth = 15 * scale;
  const maxWidth = 70 * scale;
  const minHeight = 24 * scale;
  const maxHeight = 110 * scale;
  for (const [left, right] of strips) {
    const regionWidth = right - left;
    const visited = new Uint8Array(regionWidth * height);
    const stack = new Int32Array(regionWidth * height);
    for (let y = Math.floor(height * 0.05); y < Math.floor(height * 0.98); y += 1) {
      for (let x = left; x < right; x += 1) {
        const start = y * regionWidth + x - left;
        if (visited[start]) continue;
        const pixel = (y * width + x) * 4;
        const luminance = (pixels[pixel] * 299 + pixels[pixel + 1] * 587 + pixels[pixel + 2] * 114) / 1000;
        if (luminance >= 125) continue;
        let stackLength = 1;
        stack[0] = start;
        visited[start] = 1;
        let minX = x; let maxX = x; let minY = y; let maxY = y; let area = 0;
        while (stackLength) {
          const current = stack[--stackLength];
          const currentX = left + current % regionWidth;
          const currentY = Math.floor(current / regionWidth);
          area += 1;
          minX = Math.min(minX, currentX); maxX = Math.max(maxX, currentX);
          minY = Math.min(minY, currentY); maxY = Math.max(maxY, currentY);
          const neighbours = [current - 1, current + 1, current - regionWidth, current + regionWidth];
          for (const neighbour of neighbours) {
            if (neighbour < 0 || neighbour >= visited.length || visited[neighbour]) continue;
            const neighbourX = left + neighbour % regionWidth;
            const neighbourY = Math.floor(neighbour / regionWidth);
            if (neighbourX < left || neighbourX >= right || neighbourY < Math.floor(height * 0.05) || neighbourY >= Math.floor(height * 0.98)) continue;
            const neighbourPixel = (neighbourY * width + neighbourX) * 4;
            const neighbourLuminance = (pixels[neighbourPixel] * 299 + pixels[neighbourPixel + 1] * 587 + pixels[neighbourPixel + 2] * 114) / 1000;
            if (neighbourLuminance >= 125) continue;
            visited[neighbour] = 1;
            stack[stackLength++] = neighbour;
          }
        }
        const boxWidth = maxX - minX + 1;
        const boxHeight = maxY - minY + 1;
        if (area >= minArea && boxWidth >= minWidth && boxWidth <= maxWidth && boxHeight >= minHeight && boxHeight <= maxHeight) {
          boxes.push({ left: minX, top: minY, right: maxX + 1, bottom: maxY + 1 });
        }
      }
    }
  }
  return boxes.slice(0, MAX_SCANNED_PHOTOS_PER_PAGE);
}

function cropScannedPhotos(renderedCanvas, products, pageView, scale, pageNumber) {
  if (products.length < 4) return [];
  const [left, bottom, right, top] = pageView;
  return scannedPhotoBoxes(renderedCanvas, scale).map((pixelBox, index) => {
    const pad = Math.max(2, Math.round(3 * scale));
    const box = {
      left: left + Math.max(0, pixelBox.left - pad) / scale,
      right: left + Math.min(renderedCanvas.width, pixelBox.right + pad) / scale,
      bottom: top - Math.min(renderedCanvas.height, pixelBox.bottom + pad) / scale,
      top: top - Math.max(0, pixelBox.top - pad) / scale,
    };
    if (box.left < left || box.right > right || box.bottom < bottom || box.top > top) return null;
    const crop = cropRenderedImage(renderedCanvas, box, pageView, scale, pageNumber, index + 1, 'scanned-page-crop');
    if (!crop) return null;
    crop.filename = `pdf-page-${pageNumber}-photo-${index + 1}.png`;
    crop.candidateSkus = [];
    crop.confidence = 0;
    crop.needsReview = true;
    return crop;
  }).filter(Boolean).slice(0, MAX_SCANNED_PHOTOS_PER_PAGE);
}

function associateImages(images, products, pageView) {
  const [left, bottom, right, top] = pageView;
  const pageWidth = Math.max(1, right - left); const pageHeight = Math.max(1, top - bottom);
  const candidates = images.filter((image) => {
    const width = image.boundingBox.right - image.boundingBox.left;
    const height = image.boundingBox.top - image.boundingBox.bottom;
    // A page-sized scan is source material for OCR, never a product photograph.
    return width * height / (pageWidth * pageHeight) < 0.65;
  }).map((image) => {
    const centreX = (image.boundingBox.left + image.boundingBox.right) / 2;
    const centreY = (image.boundingBox.bottom + image.boundingBox.top) / 2;
    const candidates = products.map((product) => ({
      product,
      // Native PDF text and image operators use bottom-left PDF coordinates.
      // Tesseract uses top-left coordinates in the rendered (scaled) bitmap.
      // Convert OCR positions before measuring SKU/image proximity.
      score: Math.abs(centreY - (product.source === 'ocr' ? top - product.sourceY / (product.sourceScale || RENDER_SCALE) : product.sourceY)) / pageHeight
        + (Math.abs(centreX - (product.source === 'ocr' ? left + product.sourceX / (product.sourceScale || RENDER_SCALE) : product.sourceX)) / pageWidth) * 0.28,
    })).sort((a, b) => a.score - b.score);
    const closest = candidates[0]; const runnerUp = candidates[1];
    return { image, candidates, closest, runnerUp };
  });
  // Only assign a visual once. A greedy global match protects adjacent
  // catalogue cells where each image's locally closest SKU is the same.
  const assignedImages = new Set(); const assignedProducts = new Set();
  const accepted = new Map();
  candidates.flatMap(({ image, candidates: productCandidates, runnerUp }) => productCandidates.map((candidate) => ({ image, candidate, runnerUp })))
    .sort((left, right) => left.candidate.score - right.candidate.score)
    .forEach(({ image, candidate, runnerUp }) => {
      if (assignedImages.has(image) || assignedProducts.has(candidate.product.sku)) return;
      if (candidate.score > 0.24) return;
      if (image.source === 'scanned-page-crop' && runnerUp && runnerUp.score - candidate.score < 0.045) return;
      assignedImages.add(image); assignedProducts.add(candidate.product.sku); accepted.set(image, candidate);
    });
  return candidates.map(({ image, candidates: productCandidates }) => {
    const match = accepted.get(image);
    const plausibleCandidates = productCandidates.filter(({ score }) => score <= 0.24);
    return match
      ? { ...image, skus: [match.product.sku], candidateSkus: plausibleCandidates.slice(0, 3).map(({ product }) => product.sku), confidence: Math.max(0.7, Number((1 - match.score).toFixed(2))), needsReview: false }
      : { ...image, skus: [], candidateSkus: plausibleCandidates.slice(0, 3).map(({ product }) => product.sku), confidence: 0, needsReview: true };
  });
}

function ocrWorkerConcurrency() {
  const cpuCount = os.availableParallelism?.() || os.cpus().length || 1;
  const maximum = Math.max(1, Math.min(4, cpuCount));
  const requested = Number(process.env.PDF_OCR_CONCURRENCY);
  return Number.isInteger(requested) && requested > 0 ? Math.min(requested, maximum) : maximum;
}

// Native text stays preferred. Scanned spreads are OCRed only in their table
// columns; page renders are reused for original-photo cropping.
export async function extractPdfCatalogue(buffer, { onProgress = () => {} } = {}) {
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), ...pdfDocumentOptions }).promise;
  const concurrency = ocrWorkerConcurrency();
  let nextPage = 1; const results = [];
  let completedPages = 0; let totalProducts = 0; let totalImages = 0;
  // The route persists a progress update. Serialize only that small critical
  // section; OCR/rendering for the other page continues in parallel.
  let progressWrite = Promise.resolve(); let abortedError = null;
  async function report(result) {
    progressWrite = progressWrite.then(async () => {
      completedPages += 1; totalProducts += result.products.length; totalImages += result.images.length;
      await onProgress({
        pageNumber: result.pageNumber, pageCount: document.numPages, source: result.source,
        productCount: result.products.length, imageCount: result.images.length,
        timingsMs: result.timingsMs, imageStatus: result.imageStatus,
        totalProducts, totalImages, processedPages: completedPages,
        // Useful for a lightweight progressive UI without leaking PDF bytes.
        products: result.products.map(({ sku, name, sourcePage, confidence, needsReview, imageStatus }) => ({ sku, name, sourcePage, confidence, needsReview, imageStatus })),
      });
    });
    try { await progressWrite; } catch (error) { abortedError = error; throw error; }
  }
  async function processPage() {
    let worker;
    try {
      while (!abortedError && nextPage <= document.numPages) {
        const pageNumber = nextPage; nextPage += 1;
        const page = await document.getPage(pageNumber);
        const pageStartedAt = Date.now();
        const textStartedAt = Date.now();
        const content = await page.getTextContent();
        const textMs = Date.now() - textStartedAt;
        let lines = linesFromText(content.items);
        let source = 'native';
        let rendered = null;
        let renderMs = 0;
        let recognizeMs = 0;
        let fallbackOcrMs = 0;
        let classifyMs = 0;
        let placements = null;
        if (!lines.length) {
          const scale = adaptiveRenderScale(page, RENDER_SCALE);
          rendered = await renderPdfCanvas(page, scale);
          renderMs = rendered.renderMs;
          const classifyStartedAt = Date.now();
          const layout = productTableLayout(rendered);
          classifyMs = Date.now() - classifyStartedAt;
          // The layout classifier is an optimisation, not a manufacturer
          // gate. Scanned catalogues with a different table geometry still
          // receive bounded full-page OCR and the evidence-gated generic row
          // parser below.
          if (layout.matches || hasVisiblePageContent(rendered.canvas)) {
            worker ||= await createOcrWorker();
            const ocr = await ocrPdfPage(rendered, worker, layout.separateColumns);
            lines = ocr.lines; source = 'ocr'; recognizeMs = ocr.recognizeMs;
            let detected = productsFromLines(lines, pageNumber, source, rendered.scale);
            // A classifier-positive table that produced no SKU is never
            // discarded. Full-page OCR is deliberately a narrow fallback for
            // those pages only, preserving the fast normal path.
            const matrixHints = /\b(?:MODULE|WHITE|BLACK|BROWN|PKG|PKD)\b/i.test(lines.map((line) => line.text).join(' '));
            // Full-page OCR is a bounded recovery pass for recognised product
            // tables.  It is also required when a split-spread OCR pass found
            // ordinary rows but missed a matrix header on the opposite half.
            // Keep the pass selective: no re-OCR of decorative/non-product
            // pages and no fallback for an already reconstructed matrix.
            if ((!detected.length && hasPotentialTrivoSku(lines)) || (matrixHints && !detected.some((product) => product.table?.matrix))) {
              const fallback = await ocrPdfPage(rendered, worker, false, { fullPage: true });
              const fallbackProducts = productsFromLines(fallback.lines, pageNumber, source, rendered.scale);
              fallbackOcrMs = fallback.recognizeMs;
              if (fallbackProducts.length) { lines = fallback.lines; detected = fallbackProducts; }
            }
          } else {
            source = 'skipped';
          }
        }
        const pageProducts = productsFromLines(lines, pageNumber, source, rendered?.scale || RENDER_SCALE);
        const placementsStartedAt = Date.now();
        placements ||= pageProducts.length ? await imagePlacements(page) : [];
        const imagePlacementsMs = Date.now() - placementsStartedAt;
        if (placements.length && !rendered) {
          rendered = await renderPdfCanvas(page, adaptiveRenderScale(page, IMAGE_RENDER_SCALE));
          renderMs += rendered.renderMs;
        }
        const embedded = rendered ? cropEmbeddedImages(rendered.canvas, placements, page.view, rendered.scale, pageNumber) : [];
        let scannedPhotoCount = 0;
        const photoCropStartedAt = Date.now();
        const scanned = source === 'ocr' && pageProducts.length >= 4 && embedded.length < 3 && rendered
          ? cropScannedPhotos(rendered.canvas, pageProducts, page.view, rendered.scale, pageNumber)
          : [];
        scannedPhotoCount = scanned.length;
        const photoCropMs = Date.now() - photoCropStartedAt;
        const pageImages = pageProducts.some((product) => product.generic)
          ? matchCatalogueImages([...embedded, ...scanned], pageProducts, page.view)
          : associateImages([...embedded, ...scanned], pageProducts, page.view);
        const imageStatus = !pageProducts.length ? 'not-applicable'
          : pageImages.length ? 'review'
            : placements.length ? 'extraction-failed' : 'no-photo-detected';
        const timingsMs = {
          textContent: textMs, operatorList: imagePlacementsMs, render: renderMs,
          classify: classifyMs, ocr: recognizeMs, fallbackOcr: fallbackOcrMs, photoCrop: photoCropMs, elapsed: Date.now() - pageStartedAt,
        };
        const result = { pageNumber, source, metadata: sourceMetadata(lines, pageNumber), products: pageProducts, images: pageImages, imageStatus, timingsMs, scannedPhotoCount };
        results.push(result);
        await report(result);
        page.cleanup();
      }
    } finally { if (worker) await worker.terminate(); }
  }
  const settled = await Promise.allSettled(Array.from({ length: Math.min(concurrency, document.numPages) }, () => processPage()));
  const failure = settled.find((entry) => entry.status === 'rejected');
  if (failure) throw failure.reason;
  await progressWrite;
  results.sort((a, b) => a.pageNumber - b.pageNumber);
  const products = []; const images = []; const pages = [];
  for (const result of results) {
    products.push(...result.products); images.push(...result.images);
    pages.push({ pageNumber: result.pageNumber, source: result.source, productCount: result.products.length, imageCount: result.images.length, imageStatus: result.imageStatus, scannedPhotoCount: result.scannedPhotoCount, timingsMs: result.timingsMs });
  }
  const metadataByPage = new Map(results.map((result) => [result.pageNumber, result.metadata]));
  const documentBrand = results.map((result) => result.metadata.brand).find(Boolean) || '';
  const documentIdentityEvidence = results.map((result) => result.metadata.evidence)
    .find((evidence) => /\b(?:led\s+lighting|luminaires|switches\s*(?:&|and)\s*automation|fans|wires?\s*(?:&|and)\s*cables?)\b/i.test(evidence)) || '';
  for (const product of products) {
    const metadata = metadataByPage.get(product.sourcePage);
    if (!metadata) continue;
    product.sectionEvidence = metadata.headings.join(' | ');
    product.brandEvidence = product.brandEvidence || metadata.brand || documentBrand;
    product.documentEvidence = `${metadata.evidence} ${documentIdentityEvidence}`.trim();
  }
  // OCR commonly sees the same SKU in image labels, an upcoming-products
  // panel, and the price table. Keep the most descriptive source row rather
  // than sending duplicate candidates to preview validation.
  const bySku = new Map();
  for (const product of products) {
    const key = String(product.sku || '').toUpperCase();
    const current = bySku.get(key);
    const score = (entry) => (entry.name && !promotionalCatalogueName(entry.name) ? 2 : 0) + Number(entry.confidence || 0);
    if (key && (!current || score(product) > score(current))) bySku.set(key, product);
  }
  products.splice(0, products.length, ...bySku.values());
  shareVerifiedFamilyImages(images, products);
  for (const result of results) {
    for (const product of result.products) {
      product.imageStatus = result.images.some((image) => image.skus?.includes(product.sku)) ? 'matched'
        : result.images.some((image) => image.candidateSkus?.includes(product.sku)) ? 'review'
          : result.images.length ? 'extraction-failed' : result.imageStatus;
    }
    if (result.products.some((product) => product.imageStatus === 'matched')) result.imageStatus = 'matched';
  }
  pages.forEach((page) => {
    const result = results.find((entry) => entry.pageNumber === page.pageNumber);
    if (result) page.imageStatus = result.imageStatus;
  });
  await document.destroy();
  repairVariantDescriptions(products);
  // A source-backed recovery is intentionally applied only to its documented
  // TRIVO page and only if OCR identified this document as a TRIVO catalogue.
  // Never let a documented recovery row leak into another manufacturer PDF.
  const verifiedTrivoCatalogue = products.some((product) => product.trivo || String(product.series || '').toUpperCase() === 'TRIVO');
  if (verifiedTrivoCatalogue) {
    for (const recovered of verifiedRecoveredRows) {
      if (!products.some((product) => product.sku === recovered.sku) && results.some((result) => result.pageNumber === recovered.sourcePage && result.source !== 'skipped')) {
        products.push({ ...recovered, source: 'verified-source-recovery', sourceScale: RENDER_SCALE, model: '', rating: null, confidence: 0.9, needsReview: false, imageStatus: 'no-photo-detected' });
      }
    }
  }
  return { pageCount: document.numPages, products, images, pages, documentMetadata: results.map((result) => result.metadata), nativeTextFound: products.some((product) => product.source === 'native') };
}
