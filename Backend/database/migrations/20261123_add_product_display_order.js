import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const apply = process.argv.includes('--apply');
const dbName = process.env.DB_NAME || 'jaygurudev_db';

if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
  throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: dbName,
});

try {
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'display_order'`,
    [dbName],
  );
  const [indexes] = await connection.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_product_active_order'`,
    [dbName],
  );
  const pending = [
    ...(!columns.length ? ['ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER is_best_selling'] : []),
    ...(!indexes.length ? ['ADD INDEX idx_product_active_order (is_active, display_order, created_at)'] : []),
  ];

  if (!pending.length) {
    console.log('Product display-order migration is already applied.');
  } else if (!apply) {
    console.log(`Dry run for ${dbName}: ALTER TABLE products ${pending.join(', ')};`);
    console.log('Rerun with --apply only after confirming the target database and backup.');
  } else {
    await connection.query(`ALTER TABLE products ${pending.join(', ')}`);
    console.log('Product display-order migration applied.');
  }
} finally {
  await connection.end();
}
