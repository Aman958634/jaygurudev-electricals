export function productNewestOrder(hasDisplayOrder, tableAlias = 'p') {
  return hasDisplayOrder
    ? `${tableAlias}.display_order ASC, ${tableAlias}.created_at DESC, ${tableAlias}.id DESC`
    : `${tableAlias}.created_at DESC, ${tableAlias}.id DESC`;
}

export function productInsertValues(payload, hasDisplayOrder) {
  const columns = [
    'name', 'slug', 'sku', 'description', 'short_description', 'category_id', 'brand_id', 'price', 'price_on_request',
    'stock_status', 'is_featured', 'is_best_selling', 'is_active', 'badge', 'size', 'image', 'meta_title', 'meta_description',
  ];
  const values = [
    payload.name, payload.slug, payload.sku, payload.description, payload.short_description, payload.category_id, payload.brand_id,
    payload.price, payload.price_on_request, payload.stock_status, payload.is_featured, payload.is_best_selling,
    payload.is_active, payload.badge, payload.size, payload.image, payload.meta_title, payload.meta_description,
  ];
  if (hasDisplayOrder) {
    columns.splice(12, 0, 'display_order');
    values.splice(12, 0, Number(payload.display_order ?? 0));
  }
  return { columns, values };
}
