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
  const [rows] = await connection.execute(
    `SELECT p.id, p.name, p.is_featured, p.is_active, b.name AS brand, c.name AS category
     FROM products p
     LEFT JOIN brands b ON b.id = p.brand_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE LOWER(CONCAT_WS(' ', p.name, b.name, c.name)) REGEXP ?
     ORDER BY p.id ASC`,
    ['greatwhite|great white|trivo|altech|polycab|guruttech|doorbell|gharghanti|[[:<:]]mcb[[:>:]]|[[:<:]]db[[:>:]]|[[:<:]]wire[[:>:]]'],
  );
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await connection.end();
}
