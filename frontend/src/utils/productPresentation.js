export function getPoleConfigurations(product) {
  if (!/mcb/i.test(product?.name || "")) return [];
  const specification = product?.specifications?.find(({ name }) => /pole configuration/i.test(name || ""));
  const value = specification?.value || product?.size || "";
  return String(value)
    .split(/[\/,|]/)
    .map((option) => option.trim().toUpperCase())
    .filter((option) => ["SP", "DP", "TP"].includes(option));
}

export function getProductImagePaths(product) {
  const paths = (product?.images || []).map((image) => image.image_path || image.image || image.url);
  if (product?.image) paths.unshift(product.image);
  return [...new Set(paths.filter(Boolean))];
}
