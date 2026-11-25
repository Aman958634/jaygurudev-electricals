import test from 'node:test';
import assert from 'node:assert/strict';
import slugify from '../utils/slugify.js';
import { mergePresentationSpecifications, toFrontendProduct } from '../utils/productResponse.js';
import { productInsertValues, productNewestOrder } from '../utils/productOrdering.js';
import { backendBindHost, trustProxyHops } from '../utils/networkSecurity.js';

test('slugify normalizes readable category and product names', () => {
  assert.equal(slugify('Switches & Sockets'), 'switches-and-sockets');
  assert.equal(slugify('  LED   Panel Light '), 'led-panel-light');
});

test('product response exposes stored model, capacity, unit, rating and packing without a migration', () => {
  const product = toFrontendProduct(
    { id: 2, name: 'Washing Machine', size: null },
    [],
    [
      { name: 'Model', value: 'WA70' },
      { name: 'Capacity', value: '7' },
      { name: 'Capacity unit', value: 'kg' },
      { name: 'Electrical rating', value: 'Top load' },
      { name: 'Packing', value: '1 unit' },
    ],
  );
  assert.deepEqual(
    { model: product.model, capacity: product.capacity, capacity_unit: product.capacity_unit, size: product.size, rating: product.rating, packing: product.packing },
    { model: 'WA70', capacity: '7', capacity_unit: 'kg', size: '', rating: 'Top load', packing: '1 unit' },
  );
  assert.deepEqual(
    mergePresentationSpecifications([{ name: 'Other', value: 'Keep' }], { model: 'WA70', capacity: '7', capacity_unit: 'kg' }),
    [{ name: 'Other', value: 'Keep' }, { name: 'Model', value: 'WA70' }, { name: 'Capacity', value: '7' }, { name: 'Capacity unit', value: 'kg' }],
  );
});

test('product response matches existing frontend card fields and primary image', () => {
  const product = toFrontendProduct(
    { id: 1, name: 'LED Bulb', brand_name: 'Philips', category_name: 'LED Lights', size: '9W', image: null, badge: 'Lighting', price: null },
    [
      { image_path: '/uploads/secondary.webp', is_primary: 0 },
      { image_path: '/uploads/primary.webp', is_primary: 1 },
    ],
    [{ name: 'Wattage', value: '9W' }],
  );

  assert.deepEqual(
    { id: product.id, name: product.name, brand: product.brand, category: product.category, size: product.size, image: product.image, badge: product.badge },
    { id: 1, name: 'LED Bulb', brand: 'Philips', category: 'LED Lights', size: '9W', image: '/uploads/primary.webp', badge: 'Lighting' },
  );
  assert.equal(product.price, null);
  assert.equal(product.specifications[0].value, '9W');
});

test('product SQL fallback does not reference display_order when an older schema lacks it', () => {
  const payload = {
    name: 'Legacy-compatible product', slug: 'legacy-compatible-product', sku: 'LEGACY-1', description: null,
    short_description: null, category_id: null, brand_id: null, price: null, price_on_request: 0, stock_status: 'in_stock',
    is_featured: 0, is_best_selling: 0, display_order: 42, is_active: 1, badge: null, size: null, image: null,
    meta_title: null, meta_description: null,
  };
  const insert = productInsertValues(payload, false);
  assert.equal(productNewestOrder(false), 'p.created_at DESC, p.id DESC');
  assert.equal(insert.columns.includes('display_order'), false);
  assert.equal(insert.values.includes(42), false);
  assert.match(productNewestOrder(true), /p\.display_order ASC/);
  assert.equal(productInsertValues(payload, true).columns.includes('display_order'), true);
});

test('production proxy settings trust one Nginx hop and bind the backend to loopback', () => {
  assert.equal(trustProxyHops({ NODE_ENV: 'production' }), 1);
  assert.equal(trustProxyHops({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '1' }), 1);
  assert.equal(backendBindHost({ NODE_ENV: 'production' }), '127.0.0.1');
  assert.equal(backendBindHost({ NODE_ENV: 'development' }), undefined);
  assert.throws(() => trustProxyHops({ TRUST_PROXY_HOPS: 'not-a-hop-count' }), /TRUST_PROXY_HOPS/);
});
