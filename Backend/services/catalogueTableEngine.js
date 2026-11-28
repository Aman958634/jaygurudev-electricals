const HEADER_ALIASES = {
  // A plain PRODUCT CODE header is not a colour/variant column.  Restrict
  // this specialised reconstruction to actual WHITE/BROWN-style tables so
  // ordinary catalogue price tables are not reduced to SKU fragments.
  white: /^white$/i,
  brown: /^(?:brown|black|colour|color)$/i,
  description: /^(?:description|product|particulars)$/i,
  mrp: /^(?:mrp|price|rate|rs\.?)$/i,
  packing: /^(?:pkd|pack(?:ing)?|qty)$/i,
};

const codePattern = /^\d{4,8}(?:-?[A-Z]{2,4}(?:-?[A-Z])?)?$/i;
const normaliseCode = (value) => String(value || '').toUpperCase().replace(/^(\d{4,8})([A-Z]{2,4})$/, '$1-$2').replace(/^(\d{4,8}-[A-Z]{2,4})([A-Z])$/, '$1-$2');
const rejected = /^(?:HSN|PAGE|MRP|PKD|PACK|DESCRIPTION|WHITE|BROWN|8536)$/i;
const finishLabels = new Set(['WHITE', 'BLACK', 'BROWN', 'SILVER', 'GOLD', 'MARBLE', 'BRIAR', 'GREY', 'GRAY', 'CHROME', 'WOOD']);
const moduleToken = /^\d{1,2}M(?:-[A-Z])?$/i;
const matrixSku = /^\d{4,8}(?:-?[A-Z]{1,8})+$/i;

function matrixCodeCells(row) {
  const words = row.words || [];
  const cells = [];
  // OCR can split a printed code at the hyphen ("20501-" "WH") or
  // concatenate adjacent variant cells.  Rebuild only contiguous word pairs
  // and retain their actual first-word coordinate; this normalises a source
  // artefact without inventing a SKU.
  for (let index = 0; index < words.length; index += 1) {
    const first = String(words[index].text || '').toUpperCase().replace(/\s+/g, '');
    const candidates = [first];
    const next = words[index + 1];
    if (next && Number(next.bbox?.x0 || 0) - Number(words[index].bbox?.x1 || words[index].bbox?.x0 || 0) <= 28) {
      candidates.push(`${first}${String(next.text || '').toUpperCase().replace(/\s+/g, '')}`);
    }
    for (const candidate of candidates) {
      const matches = candidate.match(/\d{4,8}\s*-?\s*[A-Z]{1,8}/g) || [];
      for (const match of matches) {
        const sku = normaliseCode(match.replace(/\s+/g, ''));
        if (matrixSku.test(sku) && !rejected.test(sku) && !cells.some((cell) => cell.sku === sku && cell.x === words[index].bbox.x0)) cells.push({ sku, x: words[index].bbox.x0 });
      }
    }
  }
  return cells;
}

function groupedRows(words) {
  const rows = [];
  for (const word of [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)) {
    const row = rows.findLast((entry) => Math.abs(entry.y - word.bbox.y0) <= Math.max(8, (word.bbox.y1 - word.bbox.y0) * 0.65));
    if (row) { row.words.push(word); row.y = (row.y * (row.words.length - 1) + word.bbox.y0) / row.words.length; }
    else rows.push({ y: word.bbox.y0, words: [word] });
  }
  return rows.map((row) => ({ ...row, words: row.words.sort((a, b) => a.bbox.x0 - b.bbox.x0) }));
}

function headerColumns(rows) {
  for (const row of rows) {
    const found = {};
    for (const word of row.words) for (const [key, matcher] of Object.entries(HEADER_ALIASES)) if (!found[key] && matcher.test(word.text)) found[key] = word.bbox.x0;
    if (found.description !== undefined && found.mrp !== undefined && (found.white !== undefined || found.brown !== undefined)) return { y: row.y, headers: found };
  }
  return null;
}

function columnFor(x, headers) {
  const ordered = Object.entries(headers).sort((a, b) => a[1] - b[1]);
  let result = ordered[0][0];
  for (const [key, start] of ordered) { if (x >= start - 18) result = key; else break; }
  return result;
}

export function reconstructCatalogueTableRows(words, { pageNumber, sourceScale = 1 } = {}) {
  const validWords = (words || []).filter((word) => word?.text && word.bbox && Number.isFinite(word.bbox.x0) && Number.isFinite(word.bbox.y0));
  const rows = groupedRows(validWords); const header = headerColumns(rows);
  if (!header) return [];
  const output = [];
  for (const row of rows.filter((entry) => entry.y > header.y + 12)) {
    const cells = {};
    for (const word of row.words) { const key = columnFor(word.bbox.x0, header.headers); cells[key] = [...(cells[key] || []), word.text]; }
    const codeValues = ['white', 'brown'].flatMap((key) => (cells[key] || []).join(' ').match(/\d{4,8}(?:-?[A-Z]{2,4}(?:-?[A-Z])?)?/gi) || []).map(normaliseCode).filter((code) => codePattern.test(code) && !rejected.test(code));
    const description = (cells.description || []).join(' ').replace(/\s+/g, ' ').trim();
    const mrpText = (cells.mrp || []).join(' '); const mrp = mrpText.match(/\d+(?:\.\d{1,2})?/)?.[0] || null;
    const packing = (cells.packing || []).join(' ').match(/\d{1,4}/)?.[0] || null;
    if (!codeValues.length || description.length < 3 || !/[a-z]/i.test(description) || !mrp) continue;
    for (const sku of [...new Set(codeValues)]) output.push({ sku, name: description, mrp, packing, sourcePage: pageNumber, sourceX: Math.min(...row.words.map((word) => word.bbox.x0)), sourceY: row.y, sourceScale, confidence: 0.84, generic: true, evidence: row.words.map((word) => word.text).join(' '), table: { headers: header.headers, rowY: row.y } });
  }
  return output;
}

function rowText(row) { return row.words.map((word) => String(word.text || '')).join(' ').replace(/\s+/g, ' ').trim(); }
function cleanMatrixTitle(value) {
  return String(value || '').replace(/\bHSN\s*(?:CODE)?\s*[:.]?\s*\d+\b/ig, '').replace(/\s+/g, ' ').replace(/[|:]+$/g, '').trim();
}
function matrixTitle(rows, headerIndex, minimumX, maximumX) {
  const candidates = [];
  for (let index = headerIndex - 1; index >= Math.max(0, headerIndex - 20); index -= 1) {
    // OCR rows from a spread contain both pages at the same y.  Use the
    // heading on this matrix's horizontal side, never unrelated product text
    // from the facing page.
    const localWords = rows[index].words.filter((word) => word.bbox.x0 >= minimumX - 90 && word.bbox.x0 <= maximumX + 90);
    const text = cleanMatrixTitle(localWords.map((word) => word.text).join(' '));
    if (text.length < 5 || /\b(?:module|mrp|pkg|packing|white|black|silver|gold|marble|briar|chrome|aqua|cherry|ivory|magnesium|grey|gray)\b/i.test(text)) continue;
    if (/[A-Z]{3}/i.test(text)) candidates.push({ text, distance: headerIndex - index });
  }
  return candidates.sort((left, right) => {
    const leftFamily = /\b(?:plate|box|series|frame|cover)\b/i.test(left.text) ? 0 : 1;
    const rightFamily = /\b(?:plate|box|series|frame|cover)\b/i.test(right.text) ? 0 : 1;
    return leftFamily - rightFamily || left.distance - right.distance;
  })[0]?.text || '';
}
function closestColumn(columns, x) {
  return columns.reduce((best, column) => Math.abs(column.x - x) < Math.abs(best.x - x) ? column : best, columns[0]);
}
function nearbyColumn(columns, x) {
  const closest = closestColumn(columns, x);
  const gaps = columns.slice(1).map((column, index) => column.x - columns[index].x).filter((gap) => gap > 0);
  const tolerance = Math.max(22, Math.min(90, (gaps.sort((left, right) => left - right)[Math.floor(gaps.length / 2)] || 70) * 0.48));
  return Math.abs(closest.x - x) <= tolerance ? closest : null;
}
function cleanMatrixFinish(value) {
  return String(value || '')
    .split(/\s+/)
    .filter((word) => /[A-Z]/i.test(word) && !/\d/.test(word))
    .join(' ')
    .replace(/[^A-Z &/-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matrixBaseAndSuffix(sku) {
  const match = String(sku || '').match(/^(\d{4,8})-([A-Z]{1,8}(?:-[A-Z])?)$/i);
  return match ? { base: match[1], suffix: match[2].toUpperCase() } : null;
}

function matrixRowConsensus(cells) {
  const parsed = cells.map((cell) => ({ ...cell, parts: matrixBaseAndSuffix(cell.sku) })).filter((cell) => cell.parts);
  if (parsed.length < 2) return [];
  const countBy = (selector) => {
    const counts = new Map();
    for (const cell of parsed) counts.set(selector(cell), (counts.get(selector(cell)) || 0) + 1);
    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  };
  const suffix = countBy((cell) => cell.parts.suffix);
  const length = countBy((cell) => cell.parts.base.length);
  // A matrix row gives us repeated independent source evidence.  Require a
  // majority agreement before treating OCR punctuation/character guesses as
  // a product code; ambiguous cells remain out of automatic import.
  if (!suffix || !length || suffix[1] < 2 || suffix[1] / parsed.length < 0.5) return [];
  return parsed.filter((cell) => cell.parts.suffix === suffix[0] && cell.parts.base.length === length[0]);
}

// Matrix catalogues print one family title then a MODULE header, finishes down
// the side, and SKU/MRP/PKG cells across columns. Reconstruct every populated
// SKU cell from its own coordinates instead of assuming one line equals one
// product. This is intentionally layout-driven and applies to any catalogue.
export function reconstructCatalogueMatrices(words, { pageNumber, sourceScale = 1 } = {}) {
  const validWords = (words || []).filter((word) => word?.text && word.bbox && Number.isFinite(word.bbox.x0) && Number.isFinite(word.bbox.y0));
  const rows = groupedRows(validWords); const output = []; const seen = new Set();
  const headers = rows.map((row, index) => ({ row, index })).filter(({ row }) => {
    const values = row.words.map((word) => String(word.text || '').toUpperCase());
    return values.includes('MODULE') && values.filter((value) => moduleToken.test(value)).length >= 2;
  });
  for (let headerNumber = 0; headerNumber < headers.length; headerNumber += 1) {
    const { row: header, index: headerIndex } = headers[headerNumber];
    const nextIndex = headers[headerNumber + 1]?.index ?? rows.length;
    const columns = header.words.filter((word) => moduleToken.test(String(word.text || '').toUpperCase()))
      .map((word) => ({ module: String(word.text).toUpperCase(), x: word.bbox.x0 })).sort((left, right) => left.x - right.x);
    if (columns.length < 2) continue;
    const title = matrixTitle(rows, headerIndex, columns[0].x, columns.at(-1).x);
    const prices = new Map(); const packs = new Map(); const skuCells = [];
    for (const row of rows.slice(headerIndex + 1, nextIndex)) {
      const labelWords = row.words.filter((word) => word.bbox.x0 >= columns[0].x - 220 && word.bbox.x0 < columns[0].x - 10);
      const localWords = row.words.filter((word) => word.bbox.x0 >= columns[0].x - 10 && word.bbox.x0 <= columns.at(-1).x + 100);
      const values = labelWords.map((word) => String(word.text || '').toUpperCase());
      // A row label is sometimes split as "P" "KG" or preceded by a
      // decorative bullet.  Resolve it from the whole left-to-right row, not
      // just the first OCR word.
      const rowLabel = values.slice(-3).join('').replace(/[^A-Z]/g, '');
      const label = finishLabels.has(values[0]) ? values[0] : rowLabel;
      if (label === 'MRP') {
        for (const word of localWords) {
          const value = String(word.text || '').replace(/,/g, ''); if (!/^\d+(?:\.\d{1,2})?$/.test(value)) continue;
          const column = nearbyColumn(columns, word.bbox.x0); if (column) prices.set(column.module, value);
        }
        continue;
      }
      if (/^(?:PKG|PKD|PACK|PACKING)$/i.test(label)) {
        for (const word of localWords) {
          const value = String(word.text || ''); if (!/^\d{1,4}$/.test(value)) continue;
          const column = nearbyColumn(columns, word.bbox.x0); if (column) packs.set(column.module, value);
        }
        continue;
      }
      const rawCells = matrixCodeCells({ words: localWords });
      // Product finish rows are detected from their own repeated SKU evidence,
      // rather than a fixed manufacturer colour list.  This supports names
      // such as Aqua Blue, Dove Grey and proprietary finishes while rejecting
      // isolated OCR fragments.
      const cells = matrixRowConsensus(rawCells);
      if (!cells.length) continue;
      const finish = finishLabels.has(values.at(-1)) ? values.at(-1) : labelWords.map((word) => String(word.text || '')).join(' ').trim();
      if (!finish || /^(?:SKU|CODE|MRP|PKG|PKD|PACK)$/i.test(finish)) continue;
      for (const cell of cells) {
        const column = nearbyColumn(columns, cell.x);
        if (column) skuCells.push({ sku: cell.sku, finish: cleanMatrixFinish(finish), module: column.module, x: cell.x, y: row.y });
      }
    }
    for (const cell of skuCells) {
      if (seen.has(cell.sku)) continue;
      seen.add(cell.sku);
      const nameParts = [title, cell.finish, cell.module].filter(Boolean);
      output.push({ sku: cell.sku, name: nameParts.join(' - '), mrp: prices.get(cell.module) || null, packing: packs.get(cell.module) || null,
        sourcePage: pageNumber, sourceX: cell.x, sourceY: cell.y, sourceScale, confidence: title ? 0.9 : 0.72, generic: true,
        specifications: [{ name: 'Finish', value: cell.finish }, { name: 'Module', value: cell.module }],
        evidence: `${title} | ${cell.finish} | ${cell.module} | ${cell.sku}`.trim(), table: { matrix: true, modules: columns.map((column) => column.module) } });
    }
  }
  return output;
}
