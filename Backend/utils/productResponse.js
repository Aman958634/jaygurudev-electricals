const PRESENTATION_SPECS = {
  model: { pattern: /^model(?:\s*(?:number|no\.?))?$/i },
  capacity: { pattern: /^capacity$/i },
  capacity_unit: { pattern: /^(?:capacity\s*unit|unit)$/i },
  size: { pattern: /^(?:size|size\s*\/\s*(?:rating|specification))$/i },
  rating: { pattern: /^(?:electrical\s*)?rating$/i },
  packing: { pattern: /^(?:packing|packing\s*\/\s*unit|unit\s*packing)$/i },
};

function valueFor(specifications, pattern) {
  const match = specifications.find((specification) => pattern.test(String(specification?.name || '')));
  return String(match?.value || '').trim();
}

export function getProductPresentationFields(product, specifications = []) {
  return {
    model: String(product.model || product.model_number || valueFor(specifications, PRESENTATION_SPECS.model.pattern) || '').trim(),
    capacity: valueFor(specifications, PRESENTATION_SPECS.capacity.pattern),
    capacity_unit: valueFor(specifications, PRESENTATION_SPECS.capacity_unit.pattern),
    size: String(product.size || valueFor(specifications, PRESENTATION_SPECS.size.pattern) || '').trim(),
    rating: valueFor(specifications, PRESENTATION_SPECS.rating.pattern),
    packing: valueFor(specifications, PRESENTATION_SPECS.packing.pattern),
  };
}

export function isPresentationSpecification(name) {
  return Object.values(PRESENTATION_SPECS).some(({ pattern }) => pattern.test(String(name || '')));
}

export function mergePresentationSpecifications(specifications, payload) {
  const fields = [
    ['model', 'Model'],
    ['capacity', 'Capacity'],
    ['capacity_unit', 'Capacity unit'],
    ['size', null],
    ['rating', 'Electrical rating'],
    ['packing', 'Packing'],
  ];
  const merged = (Array.isArray(specifications) ? specifications : [])
    .filter((specification) => specification && specification.name && specification.value)
    .filter((specification) => {
      const field = fields.find(([key]) => PRESENTATION_SPECS[key].pattern.test(String(specification.name)));
      return !field || payload[field[0]] === undefined;
    });
  fields.forEach(([key, name]) => {
    if (payload[key] === undefined) return;
    const value = String(payload[key] || '').trim();
    if (name && value) merged.push({ name, value });
  });
  return merged;
}

export function toFrontendProduct(product, images = [], specifications = []) {
  const primaryImage = images.find((image) => Number(image.is_primary) === 1) || images[0];
  return {
    ...product,
    ...getProductPresentationFields(product, specifications),
    brand: product.brand_name ?? product.brand ?? null,
    category: product.category_name ?? product.category ?? null,
    image: primaryImage?.image_path ?? product.image ?? null,
    price: product.price === null || product.price === undefined ? null : Number(product.price),
    images,
    specifications,
  };
}
