import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const dbHost = process.env.DB_HOST || 'localhost';
const localDatabase = ['localhost', '127.0.0.1', '::1'].includes(dbHost);
const temporaryDatabase = `jgd_compat_${process.pid}_${Date.now()}`;

async function findPort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Compatibility-test backend did not become ready.');
}

function schemaWithoutProductDisplayOrder() {
  const schema = fs.readFileSync(path.join(backendDirectory, 'database', 'schema.sql'), 'utf8')
    .replace(/^CREATE DATABASE IF NOT EXISTS jaygurudev_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\s*USE jaygurudev_db;\s*/i, '');
  return schema
    .replace(/(CREATE TABLE IF NOT EXISTS products \([\s\S]*?)\s+display_order INT NOT NULL DEFAULT 0,\s*([\s\S]*?\n\);)/, '$1$2')
    .replace(/^\s*INDEX idx_product_active_order \(is_active, display_order, created_at\),?\s*$/m, '');
}

test('products GET, POST, PUT and DELETE work when products.display_order is absent', { skip: !localDatabase && 'requires a local MySQL host' }, async () => {
  let connection;
  let server;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });
    // This isolated database is intentionally named and validated here; no
    // configured database, and therefore no production database, is touched.
    assert.match(temporaryDatabase, /^jgd_compat_\d+_\d+$/);
    await connection.query(`CREATE DATABASE \`${temporaryDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${temporaryDatabase}\``);
    await connection.query(schemaWithoutProductDisplayOrder());

    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'display_order'`,
      [temporaryDatabase],
    );
    assert.equal(columns.length, 0);

    const adminEmail = `compat-${Date.now()}@example.test`;
    const adminPassword = randomBytes(24).toString('base64url');
    await connection.execute(
      `INSERT INTO admins (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, 'super_admin', 1)`,
      ['Schema Compatibility Admin', adminEmail, await bcrypt.hash(adminPassword, 12)],
    );

    const port = await findPort();
    const baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['server.js'], {
      cwd: backendDirectory,
      env: { ...process.env, DB_NAME: temporaryDatabase, PORT: String(port), JWT_SECRET: randomBytes(48).toString('base64url') },
      stdio: 'ignore',
    });
    await waitForHealth(baseUrl);
    const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const login = await loginResponse.json();
    assert.equal(loginResponse.status, 200);
    const headers = { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' };

    const createdResponse = await fetch(`${baseUrl}/api/products`, {
      method: 'POST', headers, body: JSON.stringify({ name: 'No order column product', sku: `COMPAT-${Date.now()}`, display_order: 99 }),
    });
    const created = await createdResponse.json();
    assert.equal(createdResponse.status, 201);

    const listed = await (await fetch(`${baseUrl}/api/products?sort=newest`)).json();
    assert.equal(listed.data.some((product) => product.id === created.productId), true);
    const updatedResponse = await fetch(`${baseUrl}/api/products/${created.productId}`, {
      method: 'PUT', headers, body: JSON.stringify({ display_order: 3, badge: 'Compatible' }),
    });
    assert.equal(updatedResponse.status, 200);
    const updated = await (await fetch(`${baseUrl}/api/products/${created.productId}`)).json();
    assert.equal(updated.data.badge, 'Compatible');
    assert.equal(Object.hasOwn(updated.data, 'display_order'), false);
    const deletedResponse = await fetch(`${baseUrl}/api/products/${created.productId}`, { method: 'DELETE', headers });
    assert.equal(deletedResponse.status, 200);
  } finally {
    if (server && !server.killed) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await exited;
    }
    if (connection) {
      await connection.query('USE information_schema');
      await connection.query(`DROP DATABASE IF EXISTS \`${temporaryDatabase}\``);
      await connection.end();
    }
  }
});
