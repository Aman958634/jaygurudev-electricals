// Generic, evidence-only image matcher. It deliberately assigns only when a
// labelled SKU is materially closer than competing rows; everything else is
// retained as a review candidate.
export function matchCatalogueImages(images, products, pageView) {
  const [left, bottom, right, top] = pageView;
  const width = Math.max(1, right - left); const height = Math.max(1, top - bottom);
  return images.map((image) => {
    const box = image.boundingBox;
    if (!box || (box.right - box.left) * (box.top - box.bottom) / (width * height) > 0.65) return { ...image, skus: [], candidateSkus: [], needsReview: true, confidence: 0 };
    const cx = (box.left + box.right) / 2; const cy = (box.bottom + box.top) / 2;
    const ranked = products.map((product) => {
      const scale = product.sourceScale || 1;
      const px = product.source === 'ocr' ? left + product.sourceX / scale : product.sourceX;
      const py = product.source === 'ocr' ? top - product.sourceY / scale : product.sourceY;
      const variant = String(product.sku).match(/-(WH|BR|BK|MN)(?:-|$)/i)?.[1] || '';
      return { product, score: Math.abs(cx - px) / width + Math.abs(cy - py) / height, variant };
    }).sort((a, b) => a.score - b.score);
    const first = ranked[0]; const second = ranked[1];
    const certain = first && first.score < 0.34 && (!second || second.score - first.score >= 0.055);
    return certain ? { ...image, skus: [first.product.sku], candidateSkus: ranked.slice(0, 3).map((entry) => entry.product.sku), needsReview: false, confidence: Number((1 - first.score).toFixed(2)) } : { ...image, skus: [], candidateSkus: ranked.slice(0, 3).map((entry) => entry.product.sku), needsReview: true, confidence: 0 };
  });
}

const finishWords = /\b(?:white|black|brown|red|blue|green|pink|orange|gold|silver|grey|gray|chrome)\b/gi;
const finishSuffix = /-(?:WH|BK|BR|RD|BL|GR|PK|OR|GD|SL|GY)(?:-|$)/i;
function normalise(value) { return String(value || '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function skuDesignSignature(sku) {
  return normalise(sku)
    // Finish and CCT suffixes denote variants of the same fixture, not a
    // different product design. Other design tokens remain part of the key.
    .replace(/-(?:WH|BK|BR|RD|BL|GR|PK|OR|GD|SL|GY|CW|WW|NW)(?:-|$)/g, '-')
    .replace(/\d+/g, '#');
}
function familyEvidence(product) {
  const name = normalise(product.name).replace(finishWords, '').replace(/\s+-\s+/g, ' ').trim();
  const finishFromName = (normalise(product.name).match(finishWords) || []).sort().join('|');
  const finishFromSku = normalise(product.sku).match(finishSuffix)?.[0]?.replace(/-/g, '') || '';
  // A family must have an actual source heading/name. SKU prefixes alone are
  // not enough evidence because different designs frequently share a prefix.
  if (!name || name.length < 6) return null;
  return {
    key: `${product.sourcePage}|${name}|${normalise(product.model)}|${skuDesignSignature(product.sku)}`,
    finish: finishFromName || finishFromSku || 'STANDARD',
  };
}

/**
 * Expands a trusted source-photo assignment only to documented variants of the
 * same physical family. It deliberately never promotes a review candidate and
 * never crosses a page, differently-labelled design, or explicit finish.
 */
export function shareVerifiedFamilyImages(images, products) {
  const bySku = new Map(products.map((product) => [String(product.sku || '').toUpperCase(), product]));
  const families = new Map();
  for (const product of products) {
    const evidence = familyEvidence(product);
    if (!evidence) continue;
    const key = `${evidence.key}|${evidence.finish}`;
    families.set(key, [...(families.get(key) || []), product]);
  }
  for (const image of images) {
    if (image.needsReview || !image.skus?.length || Number(image.confidence || 0) < 0.7) continue;
    const seed = bySku.get(String(image.skus[0]).toUpperCase());
    const evidence = seed && familyEvidence(seed);
    if (!evidence) continue;
    const key = `${evidence.key}|${evidence.finish}`;
    const related = (families.get(key) || []).filter((product) => {
      // A spread can repeat a family title in distant columns. Keep the
      // original table/heading side as a second geometry check.
      return Math.abs(Number(product.sourceX || 0) - Number(seed.sourceX || 0)) <= 220;
    });
    if (related.length > 1) {
      image.skus = [...new Set(related.map((product) => product.sku))];
      image.candidateSkus = [...new Set([...(image.candidateSkus || []), ...image.skus])].slice(0, 12);
      image.familyVerified = true;
    }
  }
  return images;
}
