export function getPoleConfigurations(product) {
  if (!/mcb/i.test(product?.name || "")) return [];
  const specification = product?.specifications?.find(({ name }) => /pole configuration/i.test(name || ""));
  const value = specification?.value || product?.size || "";
  return String(value)
    .split(/[\/,|]/)
    .map((option) => option.trim().toUpperCase())
    .filter((option) => ["SP", "DP", "TP"].includes(option));
}

export function selectHomepageProducts(products, limit = 8) {
  const activeProducts = (Array.isArray(products) ? products : [])
    .filter((product) => product && isEnabled(product.is_active));
  const priorityProducts = activeProducts.filter(isPriorityStockProduct);
  const featuredProducts = activeProducts.filter((product) => isEnabled(product.is_featured));
  const remainingProducts = featuredProducts.length ? featuredProducts : activeProducts;
  return [...new Map(
    [...priorityProducts, ...remainingProducts]
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
  const model = displayableValue(
    product.model
      || product.model_number
      || product.modelNumber
      || specifications.find((specification) => /model/i.test(specification?.name || ""))?.value
      || "",
  );
  const sku = displayableValue(product.sku);
  const poleConfigurations = getPoleConfigurations(product);
  const details = [];

  if (model) details.push({ name: "Model", value: model });
  else if (sku) details.push({ name: "SKU", value: sku });
  const size = displayableValue(product.size);
  if (size) details.push({ name: "Size / specification", value: size });
  if (poleConfigurations.length) {
    details.push({ name: "Available pole configurations", value: poleConfigurations.join(" / ") });
  }

  for (const specification of specifications) {
    const name = String(specification?.name || "").trim();
    const value = displayableValue(specification?.value);
    if (!name || !value) continue;
    if (/model/i.test(name) && value === model) continue;
    if (/^sku$/i.test(name) && sku.toLowerCase() === value.toLowerCase()) continue;
    if (/^size(?:\s*\/\s*specification)?$/i.test(name) && size.toLowerCase() === value.toLowerCase()) continue;
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
  const model = displayableValue(
    product.model
      || product.model_number
      || product.modelNumber
      || specifications.find((specification) => /model/i.test(specification?.name || ""))?.value
      || "",
  );

  const sku = displayableValue(product.sku);
  const size = displayableValue(product.size);
  if (sku) rows.push({ key: "sku", name: "SKU", value: sku });
  if (model) rows.push({ key: "model", name: "Model", value: model });
  if (size) rows.push({ key: "size", name: "Size / specification", value: size });

  specifications.forEach((specification, index) => {
    const name = String(specification?.name || "").trim();
    const value = displayableValue(specification?.value);
    if (!name || !value) return;
    if (/^sku$/i.test(name) && sku.toLowerCase() === value.toLowerCase()) return;
    if (/model/i.test(name) && model.toLowerCase() === value.toLowerCase()) return;
    if (/^size(?:\s*\/\s*specification)?$/i.test(name) && size.toLowerCase() === value.toLowerCase()) return;
    rows.push({ key: specification.id || `${name}-${index}`, name, value });
  });

  return rows;
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
  if (/^(?:n\/?a|not available|ask for available models|contact for specification)$/i.test(normalized)) return "";
  return normalized;
}
