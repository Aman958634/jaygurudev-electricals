export function getPoleConfigurations(product) {
  if (!/mcb/i.test(product?.name || "")) return [];
  const specification = product?.specifications?.find(({ name }) => /pole configuration/i.test(name || ""));
  const value = specification?.value || product?.size || "";
  return String(value)
    .split(/[\/,|]/)
    .map((option) => option.trim().toUpperCase())
    .filter((option) => ["SP", "DP", "TP"].includes(option));
}

export function selectHomepageProducts(products, limit = 4) {
  const activeProducts = (Array.isArray(products) ? products : [])
    .filter((product) => product && isEnabled(product.is_active));
  const priorityProducts = activeProducts.filter(isPriorityStockProduct);
  const featuredProducts = activeProducts.filter((product) => isEnabled(product.is_featured));
  return [...new Map(
    [...priorityProducts, ...featuredProducts, ...activeProducts]
      .map((product) => [String(product.id), product]),
  ).values()].slice(0, limit);
}

export function isPriorityStockProduct(product) {
  const brand = String(product?.brand || "").toLowerCase();
  const name = String(product?.name || "").toLowerCase();
  const category = String(product?.category || "").toLowerCase();

  return (
    (/great\s*white/.test(brand) && /trivo/.test(name) && /switch/.test(`${name} ${category}`))
    || (/altech/.test(brand) && /(mcb|miniature circuit breaker|distribution board|\bdb\b)/i.test(`${name} ${category}`))
    || (/polycab/.test(brand) && /(wire|cable)/i.test(`${name} ${category}`))
    || (/guruttech/.test(brand) && /(gharghanti|doorbell)/i.test(`${name} ${category}`))
  );
}

export function getProductCardSpecifications(product) {
  if (!product) return [];
  const specifications = Array.isArray(product.specifications) ? product.specifications : [];
  const model = getProductField(product, specifications, "model", /^model(?:\s*(?:number|no\.?))?$/i);
  const capacity = getProductField(product, specifications, "capacity", /^capacity$/i);
  const capacityUnit = getProductField(product, specifications, "capacity_unit", /^(?:capacity\s*unit|unit)$/i);
  const packing = getProductField(product, specifications, "packing", /^(?:packing|packing\s*\/\s*unit|unit\s*packing)$/i);
  const poleConfigurations = getPoleConfigurations(product);
  const details = [];

  if (model) details.push({ name: "Model", value: model });
  if (capacity) details.push({ name: "Capacity", value: [capacity, capacityUnit].filter(Boolean).join(" ") });
  const size = displayableValue(product.size || product.size_rating);
  if (size) details.push({ name: "Size / Rating", value: size });
  if (packing) details.push({ name: "Packing", value: packing });
  if (poleConfigurations.length) {
    details.push({ name: "Available pole configurations", value: poleConfigurations.join(" / ") });
  }

  for (const specification of specifications) {
    const name = String(specification?.name || "").trim();
    const value = displayableValue(specification?.value);
    if (!name || !value) continue;
    if (/^model(?:\s*(?:number|no\.?)?)?$/i.test(name) && value === model) continue;
    if (/^capacity(?:\s*unit)?$/i.test(name)) continue;
    if (/^(?:packing|packing\s*\/\s*unit|unit\s*packing)$/i.test(name) && value === packing) continue;
    if (/^(?:size(?:\s*\/\s*(?:specification|rating))?|rating)$/i.test(name) && size.toLowerCase() === value.toLowerCase()) continue;
    if (/^pole configuration$/i.test(name) && poleConfigurations.length) {
      const options = value.split(/[\/,|]/).map((option) => option.trim().toUpperCase());
      if (options.join("|") === poleConfigurations.join("|")) continue;
    }
    details.push({ name, value });
  }

  return details;
}

export function getProductDetailSpecifications(product) {
  if (!product) return [];
  const specifications = Array.isArray(product.specifications) ? product.specifications : [];
  const rows = [];
  const model = getProductField(product, specifications, "model", /^model(?:\s*(?:number|no\.?))?$/i);
  const capacity = getProductField(product, specifications, "capacity", /^capacity$/i);
  const capacityUnit = getProductField(product, specifications, "capacity_unit", /^(?:capacity\s*unit|unit)$/i);
  const packing = getProductField(product, specifications, "packing", /^(?:packing|packing\s*\/\s*unit|unit\s*packing)$/i);
  const size = displayableValue(product.size || product.size_rating);
  if (model) rows.push({ key: "model", name: "Model", value: model });
  if (capacity) rows.push({ key: "capacity", name: "Capacity", value: [capacity, capacityUnit].filter(Boolean).join(" ") });
  if (size) rows.push({ key: "size", name: "Size / Rating", value: size });
  if (packing) rows.push({ key: "packing", name: "Packing", value: packing });

  specifications.forEach((specification, index) => {
    const name = String(specification?.name || "").trim();
    const value = displayableValue(specification?.value);
    if (!name || !value) return;
    if (/^model(?:\s*(?:number|no\.?)?)?$/i.test(name) && value === model) return;
    if (/^capacity(?:\s*unit)?$/i.test(name)) return;
    if (/^(?:packing|packing\s*\/\s*unit|unit\s*packing)$/i.test(name) && value === packing) return;
    if (/^(?:size(?:\s*\/\s*(?:specification|rating))?|rating)$/i.test(name) && size.toLowerCase() === value.toLowerCase()) return;
    rows.push({ key: specification.id || `${name}-${index}`, name, value });
  });

  return rows;
}

function getProductField(product, specifications, key, pattern) {
  return displayableValue(
    product?.[key]
      || specifications.find((specification) => pattern.test(String(specification?.name || "")))?.value
      || "",
  );
}

export function getProductImagePaths(product) {
  const paths = (product?.images || []).map((image) => image.image_path || image.image || image.url);
  if (product?.image) paths.unshift(product.image);
  return [...new Set(paths.filter(Boolean))];
}

function isEnabled(value) {
  return value === true || Number(value) === 1 || String(value).toLowerCase() === "true";
}

function displayableValue(value) {
  const normalized = String(value || "").trim();
  if (/^(?:n\/?a|not available|ask for available models|multiple models|multiple capacities|contact for specification)$/i.test(normalized)) return "";
  return normalized;
}
