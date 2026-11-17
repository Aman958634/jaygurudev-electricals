import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const email = (process.env.ADMIN_EMAIL || 'admin@jaygurudev.com').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!password || password.length < 12 || password.length > 128) {
  throw new Error('Set ADMIN_PASSWORD to a unique password between 12 and 128 characters before seeding.');
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jaygurudev_db',
});

try {
  const passwordHash = await bcrypt.hash(password, 12);
  await connection.beginTransaction();
  try {
    const [existingAdmins] = await connection.execute(
      'SELECT id FROM admins WHERE LOWER(email) = ? FOR UPDATE',
      [email],
    );

    if (existingAdmins.length) {
      await connection.execute(
        'UPDATE admins SET email = ?, password_hash = ?, is_active = 1 WHERE id = ?',
        [email, passwordHash, existingAdmins[0].id],
      );
      await connection.commit();
      console.log('Existing admin credentials updated.');
    } else {
      await connection.execute(
        `INSERT INTO admins (full_name, email, password_hash, role, is_active)
         VALUES (?, ?, ?, 'super_admin', 1)`,
        ['Super Admin', email, passwordHash],
      );
      await connection.commit();
      console.log('Initial super-admin account created.');
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  }
} finally {
  await connection.end();
}
