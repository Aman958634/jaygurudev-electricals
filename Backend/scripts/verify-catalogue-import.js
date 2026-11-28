// Isolated Smart PDF Import verification. It never uses the client database:
// node scripts/verify-catalogue-import.js "C:\path\catalogue.pdf"
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();
const pdfPath = process.argv[2];
if (!pdfPath) throw new Error('Usage: node scripts/verify-catalogue-import.js <catalogue.pdf>');
const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const database = `jgd_catalogue_verify_${process.pid}_${Date.now()}`;
const verificationRoot = process.env.VERIFICATION_STORAGE_ROOT || process.env.IMPORT_STORAGE_ROOT || tmpdir();
const storage = path.join(verificationRoot, `jgd-catalogue-verify-${randomUUID()}`);
const email = `catalogue-verify-${Date.now()}@example.test`;
const password = randomBytes(24).toString('base64url');
let connection; let server; let serverOutput = ''; let serverExit = '';

async function freePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const { port } = probe.address(); await new Promise((resolve) => probe.close(resolve)); return port;
}
async function waitFor(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(`${url}/api/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Temporary verification backend did not become healthy.');
}
async function request(base, route, { token, method = 'GET', body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  let response;
  try { response = await fetch(`${base}${route}`, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined }); }
  catch (error) { throw new Error(`${method} ${route} request failed: ${error.message}${serverExit ? `\n${serverExit}` : ''}${serverOutput ? `\n${serverOutput}` : ''}`); }
  const result = await response.json();
  if (!response.ok) throw new Error(`${method} ${route}: ${result.message || response.statusText}`);
  return result;
}
async function poll(base, jobId, token, wanted) {
  for (let attempt = 0; attempt < 900; attempt += 1) {
    const state = (await request(base, `/api/admin/products/bulk-import/status/${jobId}`, { token })).data;
    if (state.status === wanted) return state;
    if (['failed', 'cancelled', 'interrupted'].includes(state.status)) throw new Error(`Import ended as ${state.status}: ${state.fatalError || 'unknown error'}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${wanted}.`);
}

try {
  const schema = (await readFile(path.join(backendDirectory, 'database', 'schema.sql'), 'utf8'))
    .replace(/^CREATE DATABASE IF NOT EXISTS jaygurudev_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\s*USE jaygurudev_db;\s*/i, '');
  connection = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', multipleStatements: true });
  await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${database}\``); await connection.query(schema);
  await connection.execute('INSERT INTO admins (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)', ['Catalogue Verification', email, await bcrypt.hash(password, 10), 'super_admin']);
  const port = await freePort(); const base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server.js'], { cwd: backendDirectory, env: { ...process.env, NODE_ENV: 'test', BIND_HOST: '127.0.0.1', PORT: String(port), DB_NAME: database, IMPORT_STORAGE_ROOT: storage, OCR_CACHE_PATH: path.join(storage, '.ocr-cache'), PDF_OCR_CONCURRENCY: '1', JWT_SECRET: randomBytes(48).toString('base64url') }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.on('exit', (code, signal) => { serverExit = `Verification backend exited unexpectedly (code ${code}, signal ${signal || 'none'}).`; });
  await waitFor(base);
  const token = (await request(base, '/api/admin/login', { method: 'POST', body: { email, password } })).token;
  const source = await readFile(pdfPath); const form = new FormData();
  form.set('cataloguePdf', new Blob([source], { type: 'application/pdf' }), path.basename(pdfPath));
  form.set('createMissing', 'true'); form.set('duplicateMode', 'skip');
  const startedAt = Date.now();
  const submitted = await request(base, '/api/admin/products/bulk-import/validate', { token, method: 'POST', body: form });
  const preview = await poll(base, submitted.data.jobId, token, 'validated');
  const readyRows = preview.rows.filter((row) => !row.errors.length);
  assert.ok(preview.rows.length > 0, 'catalogue must yield source rows');
  assert.ok(readyRows.every((row) => row.product.images.length > 0), 'no blank-image product may import');
  await request(base, `/api/admin/products/bulk-import/review/${submitted.data.jobId}`, { token, method: 'PUT', body: { rows: preview.rows.map(({ rowNumber, product }) => ({ rowNumber, product })) } });
  await request(base, `/api/admin/products/bulk-import/start/${submitted.data.jobId}`, { token, method: 'POST', body: {} });
  const complete = await poll(base, submitted.data.jobId, token, 'completed');
  const [counts] = await connection.query('SELECT COUNT(*) AS products, SUM(category_id IS NOT NULL) AS categories, SUM(brand_id IS NOT NULL) AS brands FROM products');
  const [imageCount] = await connection.query('SELECT COUNT(*) AS images FROM product_images');
  const [categoryCount] = await connection.query('SELECT COUNT(*) AS total FROM categories');
  const [brandCount] = await connection.query('SELECT COUNT(*) AS total FROM brands');
  assert.equal(Number(counts[0].products), readyRows.length, 'only validated rows should import');
  assert.equal(Number(counts[0].categories), readyRows.length, 'every imported product needs a category');
  assert.equal(Number(counts[0].brands), readyRows.length, 'every imported product needs a brand');
  assert.ok(Number(imageCount[0].images) >= readyRows.length, 'every imported product needs permanent image storage');
  assert.ok(Number(categoryCount[0].total) > 0 && Number(brandCount[0].total) > 0, 'confirmation must create required lookup records in the isolated database');
  const publicProducts = await request(base, '/api/products?limit=100');
  assert.ok(publicProducts.pagination.total > 0, 'public product API must expose imported records');
  console.log(JSON.stringify({ file: path.basename(pdfPath), parser: preview.pdf.parserVersion, total: preview.summary.total, ready: readyRows.length, review: preview.summary.invalid, missingImages: preview.summary.missingImages, imported: counts[0].products, images: imageCount[0].images, categories: categoryCount[0].total, brands: brandCount[0].total, publicTotal: publicProducts.pagination.total, elapsedMs: Date.now() - startedAt, importProgress: complete.progress }, null, 2));
} finally {
  if (server && !server.killed) { const exited = new Promise((resolve) => server.once('exit', resolve)); server.kill(); await exited; }
  if (connection) { await connection.query('USE information_schema').catch(() => {}); await connection.query(`DROP DATABASE IF EXISTS \`${database}\``).catch(() => {}); await connection.end(); }
  await rm(storage, { recursive: true, force: true });
}
