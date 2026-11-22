import test from 'node:test';
import assert from 'node:assert/strict';
import slugify from '../utils/slugify.js';
import { mergePresentationSpecifications, toFrontendProduct } from '../utils/productResponse.js';

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
      { name: 'Size / Rating', value: 'Top load' },
      { name: 'Packing', value: '1 unit' },
    ],
  );
  assert.deepEqual(
    { model: product.model, capacity: product.capacity, capacity_unit: product.capacity_unit, size_rating: product.size_rating, packing: product.packing },
    { model: 'WA70', capacity: '7', capacity_unit: 'kg', size_rating: 'Top load', packing: '1 unit' },
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
