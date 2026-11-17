import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const schemaPath = path.resolve(process.cwd(), 'database', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8').replace(
  /^CREATE DATABASE IF NOT EXISTS jaygurudev_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\s*USE jaygurudev_db;\s*/i,
  '',
);
const dbName = process.env.DB_NAME || 'jaygurudev_db';
if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
  throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});

try {
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${dbName}\``);
  await connection.query(schemaSql);
  const [brandLogoColumns] = await connection.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'brands' AND COLUMN_NAME = 'logo_url'`,
    [dbName],
  );
  if (!brandLogoColumns.length) {
    await connection.query('ALTER TABLE brands ADD COLUMN logo_url VARCHAR(255) DEFAULT NULL AFTER category');
  }
  for (const [tableName, columnName, columnDefinition] of [
    ['categories', 'description', 'TEXT DEFAULT NULL AFTER subtitle'],
    ['brands', 'description', 'TEXT DEFAULT NULL AFTER category'],
    ['brands', 'display_order', 'INT NOT NULL DEFAULT 0 AFTER logo_url'],
    ['banners', 'button_text', 'VARCHAR(80) DEFAULT NULL AFTER description'],
  ]) {
    const [existingColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName, tableName, columnName],
    );
    if (!existingColumns.length) {
      await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
      console.log(`Added ${tableName}.${columnName}.`);
    }
  }
  const [duplicateBrandNames] = await connection.query(
    'SELECT name FROM brands GROUP BY name HAVING COUNT(*) > 1 LIMIT 5',
  );
  if (duplicateBrandNames.length) {
    const names = duplicateBrandNames.map(({ name }) => name).join(', ');
    throw new Error(`Cannot enforce unique brand names until existing duplicates are resolved: ${names}. No brand records were changed.`);
  }
  const [brandNameIndexes] = await connection.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'brands' AND INDEX_NAME = 'uq_brand_name'`,
    [dbName],
  );
  if (!brandNameIndexes.length) {
    await connection.query('ALTER TABLE brands ADD UNIQUE KEY uq_brand_name (name)');
  }
  const [brandOrderIndexes] = await connection.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'brands' AND INDEX_NAME = 'idx_brand_active_order'`,
    [dbName],
  );
  if (!brandOrderIndexes.length) {
    await connection.query('ALTER TABLE brands ADD INDEX idx_brand_active_order (is_active, display_order, name)');
  }
  const [brandAdminOrderIndexes] = await connection.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'brands' AND INDEX_NAME = 'idx_brand_order_name'`,
    [dbName],
  );
  if (!brandAdminOrderIndexes.length) {
    await connection.query('ALTER TABLE brands ADD INDEX idx_brand_order_name (display_order, name)');
  }
  const [skuIndexes] = await connection.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND INDEX_NAME = 'uq_product_sku'`,
    [dbName],
  );
  if (!skuIndexes.length) {
    await connection.query('ALTER TABLE products ADD UNIQUE KEY uq_product_sku (sku)');
  }
  for (const unusedTable of ['navigation_menus', 'reviews', 'social_links', 'testimonials']) {
    const [existingTables] = await connection.execute(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [dbName, unusedTable],
    );
    if (!existingTables.length) continue;

    const [tableRows] = await connection.query(`SELECT COUNT(*) AS row_count FROM \`${unusedTable}\``);
    if (Number(tableRows[0].row_count) === 0) {
      await connection.query(`DROP TABLE \`${unusedTable}\``);
    } else {
      console.warn(`Preserving non-empty legacy table ${unusedTable}.`);
    }
  }
  console.log('Database initialized successfully.');
} catch (error) {
  console.error('Database initialization failed:', error.message);
  process.exitCode = 1;
} finally {
  await connection.end();
}
