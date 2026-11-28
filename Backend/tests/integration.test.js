import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pool, { query } from '../config/db.js';

dotenv.config();

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));
const adminEmail = `integration-${Date.now()}@example.test`;
let adminPassword = randomBytes(24).toString('base64url');
let serverProcess;
let baseUrl;
let token;
let serverOutput = '';
const ids = { products: [], categories: [], brands: [], enquiries: [], gallery: [], banners: [], pages: [], settings: [] };
const uploadedFiles = new Set();

async function findPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForHealth() {
  let lastFailure = 'No connection attempt was made.';
  // Canvas/PDF native modules can take longer than ten seconds to initialise
  // on a cold Windows filesystem.  This is still a bounded local health poll
  // and preserves the child stdout/stderr diagnostic on an actual failure.
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error(`Backend server exited before becoming ready: ${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
      lastFailure = `HTTP ${response.status}: ${await response.text()}`;
    } catch (error) {
      lastFailure = error.message;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`Backend server did not become ready. Last health result: ${lastFailure}. Child output: ${serverOutput || '(none)'}`);
}

function startBackend(port) {
  serverOutput = '';
  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: backendDirectory,
    env: { ...process.env, NODE_ENV: 'test', BIND_HOST: '127.0.0.1', PORT: String(port), JWT_SECRET: process.env.JWT_SECRET, TRUST_PROXY_HOPS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', (chunk) => { serverOutput += chunk; });
  serverProcess.stderr.on('data', (chunk) => { serverOutput += chunk; });
}

async function restartBackend() {
  const previousServer = serverProcess;
  const stopped = new Promise((resolve) => previousServer.once('exit', resolve));
  previousServer.kill();
  await stopped;
  startBackend(new URL(baseUrl).port);
  await waitForHealth();
}

async function request(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {};
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (form) {
    body = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, { method, headers, body });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${result.message || response.statusText}`);
  }
  return result;
}

function imageForm(fields = {}, fieldName = 'image') {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/r9sAAAAASUVORK5CYII=', 'base64');
  form.append(fieldName, new Blob([png], { type: 'image/png' }), 'pixel.png');
  return form;
}

before(async () => {
  await query('SELECT 1');
  process.env.JWT_SECRET = randomBytes(48).toString('base64url');
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const result = await query(
    `INSERT INTO admins (full_name, email, password_hash, role, is_active)
     VALUES (?, ?, ?, 'super_admin', 1)`,
    ['Integration Test Admin', adminEmail, passwordHash],
  );
  ids.admin = result.insertId;

  const port = await findPort();
  baseUrl = `http://127.0.0.1:${port}`;
  startBackend(port);
  await waitForHealth();
});

after(async () => {
  if (serverProcess && !serverProcess.killed) {
    const exited = new Promise((resolve) => serverProcess.once('exit', resolve));
    serverProcess.kill();
    await exited;
  }
  for (const id of ids.products) await query('DELETE FROM products WHERE id = ?', [id]);
  for (const id of ids.categories) await query('DELETE FROM categories WHERE id = ?', [id]);
  for (const id of ids.brands) await query('DELETE FROM brands WHERE id = ?', [id]);
  for (const id of ids.enquiries) await query('DELETE FROM enquiries WHERE id = ?', [id]);
  for (const id of ids.gallery) await query('DELETE FROM gallery WHERE id = ?', [id]);
  for (const id of ids.banners) await query('DELETE FROM banners WHERE id = ?', [id]);
  for (const id of ids.pages) await query('DELETE FROM pages WHERE id = ?', [id]);
  for (const id of ids.settings) await query('DELETE FROM site_settings WHERE id = ?', [id]);
  for (const file of uploadedFiles) {
    const filename = path.basename(file);
    await unlink(path.join(backendDirectory, 'uploads', filename)).catch(() => {});
  }
  if (ids.admin) {
    await query('DELETE FROM admin_activity_logs WHERE admin_id = ?', [ids.admin]);
    await query('DELETE FROM admins WHERE id = ?', [ids.admin]);
  }
  await pool.end();
});

test('public APIs, admin CRUD, enquiries, uploads, and auth work with MySQL', async () => {
  const health = await request('/api/health', { auth: false });
  assert.equal(health.success, true);
  const unauthenticatedAdminList = await fetch(`${baseUrl}/api/products/admin/list`);
  assert.equal(unauthenticatedAdminList.status, 401);
  const publicRegistration = await fetch(`${baseUrl}/api/admin/register`, { method: 'POST' });
  assert.equal(publicRegistration.status, 404);

  const login = await request('/api/admin/login', {
    method: 'POST',
    auth: false,
    body: { email: adminEmail, password: adminPassword },
  });
  token = login.token;
  assert.ok(token);
  assert.equal((await request('/api/admin/me')).admin.email, adminEmail);

  for (const path of ['/api/products', '/api/products/', '/api/products/featured/list', '/api/categories', '/api/brands', '/api/gallery', '/api/pages/', '/api/settings', '/api/statistics']) {
    const result = await request(path, { auth: false });
    assert.equal(result.success, true, `${path} should be publicly available`);
  }

  const categoryForm = imageForm({ name: `Integration category ${Date.now()}`, subtitle: 'Test category', description: 'Category description', icon: 'sun' });
  const categoryCreated = await request('/api/categories', { method: 'POST', form: categoryForm });
  ids.categories.push(categoryCreated.id);
  const category = await request(`/api/categories/${categoryCreated.id}`, { auth: false });
  assert.equal(category.data.description, 'Category description');
  assert.ok(category.data.image.startsWith('/uploads/'));
  uploadedFiles.add(category.data.image);
  const imageResponse = await fetch(`${baseUrl}${category.data.image}`);
  assert.equal(imageResponse.status, 200);
  await request(`/api/categories/${categoryCreated.id}`, { method: 'PUT', body: { subtitle: 'Updated test category' } });
  assert.equal((await request('/api/categories/admin/list')).success, true);

  const brandForm = imageForm({ name: `Integration brand ${Date.now()}`, category: 'Electricals', description: 'Brand description' }, 'logo');
  const brandCreated = await request('/api/brands', { method: 'POST', form: brandForm });
  ids.brands.push(brandCreated.id);
  const generatedBrandNames = [brandForm.get('name')];
  const brandBatchMarker = `Integration batch brand ${Date.now()}`;
  for (let index = 1; index < 30; index += 1) {
    const name = `${brandBatchMarker} ${index}`;
    const result = await request('/api/brands', {
      method: 'POST',
      body: { name, category: 'Integration test', display_order: index },
    });
    ids.brands.push(result.id);
    generatedBrandNames.push(name);
  }
  const adminBrands = await request('/api/brands/admin/list');
  assert.equal(adminBrands.data.filter((entry) => generatedBrandNames.includes(entry.name)).length, 30);
  assert.ok(adminBrands.data.find((entry) => entry.id === ids.brands[1]).display_order > 0);
  const paginatedBrands = await request(`/api/brands/admin/list?page=1&limit=10&search=${encodeURIComponent(brandBatchMarker)}`);
  assert.equal(paginatedBrands.data.length, 10);
  assert.equal(paginatedBrands.pagination.total, 29);
  assert.equal(paginatedBrands.pagination.totalPages, 3);
  await request(`/api/brands/${ids.brands[1]}`, { method: 'PUT', body: { display_order: 31, is_active: false } });
  assert.equal((await request('/api/brands/admin/list')).data.find((entry) => entry.id === ids.brands[1]).display_order, 31);

  const duplicateNameResponse = await fetch(`${baseUrl}/api/brands`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: generatedBrandNames[0], slug: `distinct-${Date.now()}` }),
  });
  assert.equal(duplicateNameResponse.status, 409);
  const duplicateSlugResponse = await fetch(`${baseUrl}/api/brands`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Distinct integration name ${Date.now()}`, slug: adminBrands.data.find((entry) => entry.id === brandCreated.id).slug }),
  });
  assert.equal(duplicateSlugResponse.status, 409);

  await request(`/api/brands/${ids.brands[1]}`, { method: 'PUT', body: { is_active: false } });
  assert.equal((await request('/api/brands', { auth: false })).data.some((entry) => entry.id === ids.brands[1]), false);
  await request(`/api/brands/${ids.brands[1]}`, { method: 'PUT', body: { is_active: true } });
  assert.equal((await request('/api/brands', { auth: false })).data.some((entry) => entry.id === ids.brands[1]), true);
  const disposableBrand = await request('/api/brands', { method: 'POST', body: { name: `Disposable integration brand ${Date.now()}` } });
  ids.brands.push(disposableBrand.id);
  await request(`/api/brands/${disposableBrand.id}`, { method: 'DELETE' });
  const deletedBrandResponse = await fetch(`${baseUrl}/api/brands/${disposableBrand.id}`);
  assert.equal(deletedBrandResponse.status, 404);

  const brandsList = await request('/api/brands', { auth: false });
  const brand = brandsList.data.find((entry) => entry.id === brandCreated.id);
  assert.ok(brand.logo_url.startsWith('/uploads/'));
  assert.equal(brand.description, 'Brand description');
  uploadedFiles.add(brand.logo_url);
  const originalLogoUrl = brand.logo_url;
  const replacementLogoForm = imageForm({}, 'logo');
  await request(`/api/brands/${brandCreated.id}`, { method: 'PUT', form: replacementLogoForm });
  const updatedBrand = await request(`/api/brands/${brandCreated.id}`, { auth: false });
  assert.notEqual(updatedBrand.data.logo_url, originalLogoUrl);
  uploadedFiles.add(updatedBrand.data.logo_url);
  assert.equal((await fetch(`${baseUrl}${updatedBrand.data.logo_url}`)).status, 200);
  await restartBackend();
  const persistedBrand = await request(`/api/brands/${brandCreated.id}`, { auth: false });
  assert.equal(persistedBrand.data.logo_url, updatedBrand.data.logo_url);
  assert.equal((await fetch(`${baseUrl}${persistedBrand.data.logo_url}`)).status, 200);
  await request(`/api/brands/${brandCreated.id}`, { method: 'PUT', body: { remove_logo: true } });
  assert.equal((await request(`/api/brands/${brandCreated.id}`, { auth: false })).data.logo_url, null);
  await request(`/api/brands/${brandCreated.id}`, { method: 'PUT', body: { category: 'Updated electricals' } });
  assert.equal((await request('/api/brands/admin/list')).success, true);

  const productForm = imageForm({
    name: `Integration product ${Date.now()}`,
    category_id: categoryCreated.id,
    brand_id: brandCreated.id,
    slug: `integration-product-${Date.now()}`,
    sku: `TEST-${Date.now()}`,
    size: '9W / 12W',
    model: 'LED-12W-TEST',
    capacity: '12',
    capacity_unit: 'W',
    rating: '220V',
    display_order: '7',
    badge: 'Lighting',
    is_featured: 'true',
    specifications: JSON.stringify([{ name: 'Wattage', value: '9W / 12W' }]),
  }, 'images');
  const productCreated = await request('/api/products', { method: 'POST', form: productForm });
  ids.products.push(productCreated.productId);
  const productsList = await request(`/api/products?search=12W&category=${encodeURIComponent(category.data.name)}&brand=${encodeURIComponent(brand.name)}`, { auth: false });
  assert.equal(productsList.data.length, 1);
  assert.equal(productsList.data[0].brand, brand.name);
  assert.equal(productsList.data[0].category, category.data.name);
  assert.equal(productsList.data[0].model, 'LED-12W-TEST');
  assert.equal(productsList.data[0].capacity, '12');
  assert.equal(productsList.data[0].capacity_unit, 'W');
  assert.equal(productsList.data[0].rating, '220V');
  if ('display_order' in productsList.data[0]) assert.equal(productsList.data[0].display_order, 7);
  assert.ok(productsList.data[0].image.startsWith('/uploads/'));
  uploadedFiles.add(productsList.data[0].image);
  assert.equal((await fetch(`${baseUrl}${productsList.data[0].image}`)).status, 200);
  assert.equal(productsList.data[0].specifications.find((specification) => specification.name === 'Wattage')?.value, '9W / 12W');
  assert.equal((await request('/api/products/featured/list', { auth: false })).data[0].id, productCreated.productId);
  assert.equal((await request('/api/products/admin/list')).data[0].id, productCreated.productId);
  await request(`/api/products/${productCreated.productId}`, {
    method: 'PUT',
    body: { badge: 'Updated badge', size: '15W', rating: '240V', display_order: 3, is_active: true, is_featured: true, price_on_request: false },
  });
  const updatedProduct = (await request(`/api/products/${productCreated.productId}`, { auth: false })).data;
  assert.equal(updatedProduct.badge, 'Updated badge');
  assert.equal(updatedProduct.is_active, 1);
  assert.equal(updatedProduct.is_featured, 1);
  assert.equal(updatedProduct.price_on_request, 0);
  assert.equal(updatedProduct.size, '15W');
  assert.equal(updatedProduct.rating, '240V');
  if ('display_order' in updatedProduct) assert.equal(updatedProduct.display_order, 3);
  await request(`/api/products/${productCreated.productId}`, { method: 'PUT', form: imageForm({}, 'images') });
  const productWithAdditionalImage = (await request(`/api/products/${productCreated.productId}`, { auth: false })).data;
  assert.equal(productWithAdditionalImage.images.length, 2);
  assert.equal(productWithAdditionalImage.images[0].image_path, productsList.data[0].image);
  const additionalImage = productWithAdditionalImage.images.find((image) => image.image_path !== productsList.data[0].image);
  assert.ok(additionalImage?.image_path.startsWith('/uploads/'));
  uploadedFiles.add(additionalImage.image_path);

  const galleryCreated = await request('/api/gallery', { method: 'POST', form: imageForm({ title: 'Integration gallery image', category: 'Test' }) });
  ids.gallery.push(galleryCreated.id);
  const galleryItem = (await request('/api/gallery', { auth: false })).data.find((item) => item.id === galleryCreated.id);
  uploadedFiles.add(galleryItem.image);
  assert.equal((await fetch(`${baseUrl}${galleryItem.image}`)).status, 200);
  assert.equal((await request('/api/gallery/admin/list')).success, true);
  await request(`/api/gallery/${galleryCreated.id}`, { method: 'PUT', body: { title: 'Updated gallery image' } });
  const invalidImageForm = new FormData();
  invalidImageForm.append('title', 'Rejected file');
  invalidImageForm.append('image', new Blob(['not an image'], { type: 'application/pdf' }), 'document.pdf');
  const invalidImageResponse = await fetch(`${baseUrl}/api/gallery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: invalidImageForm,
  });
  assert.equal(invalidImageResponse.status, 400);
  const spoofedImageForm = new FormData();
  spoofedImageForm.append('title', 'Rejected spoofed image');
  spoofedImageForm.append('image', new Blob(['not a png'], { type: 'image/png' }), 'spoofed.png');
  await assert.rejects(
    request('/api/gallery', { method: 'POST', form: spoofedImageForm }),
    /\(400\)/,
  );
  await assert.rejects(
    request('/api/banners', { method: 'POST', body: { title: 'Banner without image' } }),
    /\(400\)/,
  );
  const bannerCreated = await request('/api/banners', { method: 'POST', form: imageForm({ title: 'Integration banner', category: 'LED Lights', button_text: 'Explore lighting' }) });
  ids.banners.push(bannerCreated.id);
  const banner = (await request('/api/banners')).data.find((item) => item.id === bannerCreated.id);
  uploadedFiles.add(banner.image);
  assert.equal(banner.button_text, 'Explore lighting');
  assert.equal((await fetch(`${baseUrl}${banner.image}`)).status, 200);
  assert.equal((await request('/api/banners/admin/list')).success, true);
  await request(`/api/banners/${bannerCreated.id}`, { method: 'PUT', body: { title: 'Updated integration banner' } });

  const pageSlug = `integration-page-${Date.now()}`;
  const pageCreated = await request('/api/pages', { method: 'POST', body: { title: 'Integration page', slug: pageSlug, description: 'Original page copy' } });
  ids.pages.push(pageCreated.id);
  assert.equal((await request('/api/pages/', { auth: false })).success, true);
  await request(`/api/pages/${pageCreated.id}`, { method: 'PUT', body: { heading: 'Updated page heading', description: 'Updated page copy' } });
  const publicPage = await request(`/api/pages/${pageSlug}`, { auth: false });
  assert.equal(publicPage.data.heading, 'Updated page heading');
  assert.equal(publicPage.data.description, 'Updated page copy');
  assert.equal((await request('/api/pages/admin/list')).success, true);
  const sectionCreated = await request(`/api/pages/${pageCreated.id}/sections`, {
    method: 'POST',
    body: { section_key: 'intro', title: 'Intro section', content: 'Test page content' },
  });
  assert.equal((await request(`/api/pages/${pageCreated.id}/sections`, { auth: false })).data[0].id, sectionCreated.id);
  await request(`/api/pages/${pageCreated.id}/sections/${sectionCreated.id}`, { method: 'PUT', body: { title: 'Updated intro section' } });
  await request(`/api/pages/${pageCreated.id}/sections/${sectionCreated.id}`, { method: 'DELETE' });

  const settingKey = `integration_setting_${Date.now()}`;
  const settingCreated = await request('/api/settings', { method: 'POST', body: { key_name: settingKey, key_value: 'Test value' } });
  if (settingCreated.id) ids.settings.push(settingCreated.id);
  assert.equal((await request('/api/settings/admin/list')).success, true);
  await request(`/api/settings/${settingKey}`, { method: 'PUT', body: { key_value: 'Updated test value' } });
  await request(`/api/settings/${settingKey}`, { method: 'DELETE' });
  const publicSettings = await request('/api/settings', { auth: false });
  const savedBusinessSettings = await query('SELECT key_name, key_value FROM site_settings WHERE key_name IN (?, ?)', ['name', 'hours']);
  const savedBusinessByKey = Object.fromEntries(savedBusinessSettings.map((setting) => [setting.key_name, setting.key_value]));
  assert.equal(publicSettings.business.name, savedBusinessByKey.name);
  assert.equal(publicSettings.business.hours, savedBusinessByKey.hours);
  /* Legacy fixture assertion retained for source-history readability:
  assert.equal(publicSettings.business.hours, 'Monday – Saturday · 8:00 AM – 8:00 PM · Sunday: CLOSED');

  */
  const statisticCreated = await request('/api/statistics', {
    method: 'POST',
    body: { metric_key: `integration_${Date.now()}`, metric_value: '1+', label: 'Integration stat', display_order: 10 },
  });
  await request(`/api/statistics/${statisticCreated.id}`, { method: 'PUT', body: { metric_value: '2+' } });
  assert.equal((await request('/api/statistics/admin/list')).success, true);
  await request(`/api/statistics/${statisticCreated.id}`, { method: 'DELETE' });

  const enquiryCreated = await request('/api/enquiries', {
    method: 'POST',
    auth: false,
    body: { name: 'Test customer', shop: 'Test shop', city: 'Palanpur', phone: '+91 99999 12345', requirement: '20 switches', enquiry_type: 'wholesale' },
  });
  ids.enquiries.push(enquiryCreated.id);
  const enquiry = await request(`/api/enquiries/${enquiryCreated.id}`);
  assert.equal(enquiry.data.customer_name, 'Test customer');
  await request(`/api/enquiries/${enquiryCreated.id}/status`, { method: 'PATCH', body: { status: 'contacted' } });
  const dashboard = await request('/api/dashboard/summary');
  assert.equal(dashboard.success, true);
  assert.equal(typeof dashboard.data.galleryImages, 'number');
  assert.ok(dashboard.data.recentEnquiries.some((item) => item.id === enquiryCreated.id));
  assert.equal((await request('/api/admin/activity')).success, true);

  await request(`/api/products/${productCreated.productId}`, { method: 'DELETE' });
  ids.products = ids.products.filter((id) => id !== productCreated.productId);
  await request(`/api/categories/${categoryCreated.id}`, { method: 'DELETE' });
  ids.categories = ids.categories.filter((id) => id !== categoryCreated.id);
  await request(`/api/brands/${brandCreated.id}`, { method: 'DELETE' });
  ids.brands = ids.brands.filter((id) => id !== brandCreated.id);
  await request(`/api/gallery/${galleryCreated.id}`, { method: 'DELETE' });
  ids.gallery = ids.gallery.filter((id) => id !== galleryCreated.id);
  await request(`/api/banners/${bannerCreated.id}`, { method: 'DELETE' });
  ids.banners = ids.banners.filter((id) => id !== bannerCreated.id);
  await request(`/api/pages/${pageCreated.id}`, { method: 'DELETE' });
  ids.pages = ids.pages.filter((id) => id !== pageCreated.id);
  await request(`/api/enquiries/${enquiryCreated.id}/status`, { method: 'PATCH', body: { status: 'closed' } });
  await request(`/api/enquiries/${enquiryCreated.id}`, { method: 'DELETE' });
  ids.enquiries = ids.enquiries.filter((id) => id !== enquiryCreated.id);
  const deletedEnquiry = await fetch(`${baseUrl}/api/enquiries/${enquiryCreated.id}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(deletedEnquiry.status, 404);

  const newPassword = randomBytes(24).toString('base64url');
  await request('/api/admin/change-password', { method: 'POST', body: { current_password: adminPassword, new_password: newPassword } });
  const failedLogin = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  assert.equal(failedLogin.status, 401);
  adminPassword = newPassword;
  const relogin = await request('/api/admin/login', { method: 'POST', auth: false, body: { email: adminEmail, password: adminPassword } });
  token = relogin.token;
});

test('saving the home page persists exact hero copy and the public page endpoint returns it', async () => {
  if (!token) {
    const login = await request('/api/admin/login', {
      method: 'POST',
      auth: false,
      body: { email: adminEmail, password: adminPassword },
    });
    token = login.token;
  }
  const originalRows = await query('SELECT id, title, heading, description, is_active FROM pages WHERE slug = ? LIMIT 1', ['home']);
  let original = originalRows[0];
  let createdHomeForTest = false;
  // The dedicated integration database is deliberately not seeded.  Create a
  // minimal row only there and remove it in finally; a real home page is
  // always restored rather than reseeded or overwritten.
  if (!original) {
    const created = await query(
      'INSERT INTO pages (slug, title, heading, description, is_active) VALUES (?, ?, ?, ?, 1)',
      ['home', 'Integration home title', 'Integration home heading', 'Integration home description'],
    );
    original = { id: created.insertId, title: 'Integration home title', heading: 'Integration home heading', description: 'Integration home description', is_active: 1 };
    createdHomeForTest = true;
  }
  const marker = `SYNC-${Date.now()}`;
  const title = `${marker} title`;
  const heading = `${marker} heading`;
  const description = `${marker} description`;

  try {
    await request(`/api/pages/${original.id}`, { method: 'PUT', body: { title, heading, description, is_active: true } });
    const storedRows = await query('SELECT title, heading, description FROM pages WHERE id = ?', [original.id]);
    assert.deepEqual(storedRows[0], { title, heading, description });
    const publicPage = await request('/api/pages/home', { auth: false });
    assert.equal(publicPage.data.title, title);
    assert.equal(publicPage.data.page_title, title);
    assert.equal(publicPage.data.heading, heading);
    assert.equal(publicPage.data.description, description);
    assert.equal(publicPage.data.content, description);
  } finally {
    if (createdHomeForTest) await query('DELETE FROM pages WHERE id = ?', [original.id]);
    else await query(
      'UPDATE pages SET title = ?, heading = ?, description = ?, is_active = ? WHERE id = ?',
      [original.title, original.heading, original.description, original.is_active, original.id],
    );
  }
});

test('business settings persist through MySQL and the public settings endpoint', async () => {
  if (!token) {
    const login = await request('/api/admin/login', { method: 'POST', auth: false, body: { email: adminEmail, password: adminPassword } });
    token = login.token;
  }
  const keys = ['name', 'phone', 'email', 'address', 'phoneDigits', 'hours', 'mapsUrl', 'businessHours', 'socialLinkedIn', 'footerDescription', 'footerNote'];
  const originals = await query(`SELECT key_name, key_value, description FROM site_settings WHERE key_name IN (${keys.map(() => '?').join(', ')})`, keys);
  const originalByKey = new Map(originals.map((row) => [row.key_name, row]));
  const marker = `SYNC-${Date.now()}`;
  const updates = {
    name: `${marker} Electricals`,
    footerDescription: `${marker} footer description`,
    footerNote: `${marker} footer note`,
    phone: '+91 99999 12345',
    email: `sync-${Date.now()}@example.test`,
    address: `${marker} Address`,
    phoneDigits: '919999912345',
    hours: 'Monday–Saturday: 8:00 AM – 8:00 PM · Sunday: CLOSED',
    mapsUrl: 'https://maps.example.test/location',
    businessHours: JSON.stringify(Array.from({ length: 7 }, (_, index) => ({ day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index], open: '08:00', close: '20:00', closed: index === 6 }))),
    socialLinkedIn: 'https://www.linkedin.com/company/example',
  };
  try {
    for (const [key, value] of Object.entries(updates)) {
      const existing = originalByKey.get(key);
      await request(existing ? `/api/settings/${key}` : '/api/settings', {
        method: existing ? 'PUT' : 'POST',
        body: existing ? { key_value: value } : { key_name: key, key_value: value, description: `Integration ${key}` },
      });
    }
    const stored = await query(`SELECT key_name, key_value FROM site_settings WHERE key_name IN (${keys.map(() => '?').join(', ')})`, keys);
    const storedByKey = Object.fromEntries(stored.map((row) => [row.key_name, row.key_value]));
    assert.equal(storedByKey.phone, updates.phone);
    assert.equal(storedByKey.name, updates.name);
    assert.equal(storedByKey.businessHours, updates.businessHours);
    const publicSettings = await request('/api/settings', { auth: false });
    assert.equal(publicSettings.business.phone, updates.phone);
    assert.equal(publicSettings.business.name, updates.name);
    assert.equal(publicSettings.business.footerDescription, updates.footerDescription);
    assert.equal(publicSettings.business.footerNote, updates.footerNote);
    assert.equal(publicSettings.business.email, updates.email);
    assert.equal(publicSettings.business.mapsUrl, updates.mapsUrl);
    assert.equal(publicSettings.business.socialLinkedIn, updates.socialLinkedIn);
  } finally {
    for (const key of keys) {
      const original = originalByKey.get(key);
      if (original) await query('UPDATE site_settings SET key_value = ?, description = ? WHERE key_name = ?', [original.key_value, original.description, key]);
      else await query('DELETE FROM site_settings WHERE key_name = ?', [key]);
    }
  }
});

test('verified administrators bypass public request counts while public, expired, and login requests remain protected', async () => {
  if (!token) {
    const login = await request('/api/admin/login', { method: 'POST', auth: false, body: { email: adminEmail, password: adminPassword } });
    token = login.token;
  }
  const adminHeaders = { Authorization: `Bearer ${token}`, 'X-Forwarded-For': '198.51.100.44' };
  const adminResponses = await Promise.all(Array.from({ length: 205 }, () => fetch(`${baseUrl}/api/admin/me`, { headers: adminHeaders })));
  assert.equal(adminResponses.every((response) => response.status === 200), true);

  const unauthorized = await fetch(`${baseUrl}/api/products/admin/list`, { headers: { 'X-Forwarded-For': '198.51.100.45' } });
  assert.equal(unauthorized.status, 401);
  const expiredToken = jwt.sign({ id: ids.admin, email: adminEmail, role: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: -1 });
  const expired = await fetch(`${baseUrl}/api/admin/me`, { headers: { Authorization: `Bearer ${expiredToken}`, 'X-Forwarded-For': '198.51.100.46' } });
  assert.equal(expired.status, 401);

  // This simulates Nginx forwarding a client address. With trust proxy set for
  // exactly one trusted hop, this must not trigger ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
  const forwardedAdmin = await fetch(`${baseUrl}/api/admin/me`, { headers: adminHeaders });
  assert.equal(forwardedAdmin.status, 200);

  const publicResponses = await Promise.all(Array.from({ length: 201 }, () => fetch(`${baseUrl}/api/health`, { headers: { 'X-Forwarded-For': '198.51.100.47' } })));
  assert.equal(publicResponses.filter((response) => response.status === 200).length, 200);
  assert.equal(publicResponses.filter((response) => response.status === 429).length, 1);

  const badLoginHeaders = { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.48' };
  const failedLogins = await Promise.all(Array.from({ length: 11 }, () => fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST', headers: badLoginHeaders, body: JSON.stringify({ email: adminEmail, password: 'incorrect-password' }),
  })));
  assert.equal(failedLogins.filter((response) => response.status === 401).length, 10);
  assert.equal(failedLogins.filter((response) => response.status === 429).length, 1);
});
