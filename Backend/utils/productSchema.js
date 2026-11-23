import { queryOne } from '../config/db.js';

let productDisplayOrderPromise;

// Older deployed databases predate this optional column. Reading information_schema
// is non-mutating and lets the same build run against either schema.
export function hasProductDisplayOrder() {
  if (!productDisplayOrderPromise) {
    productDisplayOrderPromise = queryOne(
      `SELECT 1 AS column_exists
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'display_order'
       LIMIT 1`,
    )
      .then(Boolean)
      // Falling back is safer than failing product reads if metadata access is restricted.
      .catch(() => false);
  }
  return productDisplayOrderPromise;
}

