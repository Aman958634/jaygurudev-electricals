import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jaygurudev_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  multipleStatements: false,
});

export const query = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

export const queryOne = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
};

export default pool;
