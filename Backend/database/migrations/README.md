# Safe product display-order migration

This migration is additive and idempotent. It adds `products.display_order` and its read-order index; it does not update or delete product records, IDs, images, or specifications.

1. Back up the intended database and verify `DB_HOST` and `DB_NAME`.
2. Run the dry run: `node database/migrations/20261123_add_product_display_order.js`
3. Review the printed target and SQL.
4. Apply only with explicit approval: `node database/migrations/20261123_add_product_display_order.js --apply`

Rollback is not automated. If a rollback is approved before any display-order values are used, restore the verified backup or have a database administrator remove the index and column in a maintenance window.
