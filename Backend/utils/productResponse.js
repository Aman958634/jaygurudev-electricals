export function toFrontendProduct(product, images = [], specifications = []) {
  const primaryImage = images.find((image) => Number(image.is_primary) === 1) || images[0];
  return {
    ...product,
    brand: product.brand_name ?? product.brand ?? null,
    category: product.category_name ?? product.category ?? null,
    image: primaryImage?.image_path ?? product.image ?? null,
    price: product.price === null || product.price === undefined ? null : Number(product.price),
    images,
    specifications,
  };
}
