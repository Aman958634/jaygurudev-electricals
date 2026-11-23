import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jaygurudev_db',
});

try {
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pages'
     ORDER BY ORDINAL_POSITION`,
  );
  const [rows] = await connection.execute(
    'SELECT * FROM pages WHERE slug = ? LIMIT 1',
    ['home'],
  );
  console.log(JSON.stringify({ columns: columns.map(({ COLUMN_NAME }) => COLUMN_NAME), home: rows[0] || null }, null, 2));
} finally {
  await connection.end();
}
