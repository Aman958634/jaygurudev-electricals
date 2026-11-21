import test from "node:test";
import assert from "node:assert/strict";
import {
  getProductCardSpecifications,
  getProductDetailSpecifications,
  selectHomepageProducts,
} from "../src/utils/productPresentation.js";

test("homepage selection prefers active featured products, fills from active stock, and ignores inactive records", () => {
  const products = [
    { id: 1, is_active: 1, is_featured: 0, name: "Latest product" },
    { id: 2, is_active: 1, is_featured: 1, name: "Featured product" },
    { id: 3, is_active: 0, is_featured: 1, name: "Inactive featured product" },
  ];

  assert.deepEqual(selectHomepageProducts(products).map((product) => product.id), [2, 1]);
});

test("homepage selection falls back to the newest active products in API order", () => {
  const products = [
    { id: 1, is_active: 0, is_featured: 0 },
    { id: 2, is_active: 1, is_featured: 0 },
    { id: 3, is_active: true, is_featured: false },
  ];

  assert.deepEqual(selectHomepageProducts(products, 1).map((product) => product.id), [2]);
});

test("homepage selection returns exactly four unique active products when four or more are available", () => {
  const products = [
    { id: 1, is_active: 1, is_featured: 0, name: "Latest product" },
    { id: 2, is_active: 1, is_featured: 1, name: "Featured product" },
    { id: 3, is_active: 1, is_featured: 0, name: "Trivo Switch", brand: "GreatWhite", category: "Switches" },
    { id: 4, is_active: 1, is_featured: 0, name: "Next product" },
    { id: 5, is_active: 1, is_featured: 0, name: "Another product" },
  ];

  const selected = selectHomepageProducts(products);
  assert.equal(selected.length, 4);
  assert.equal(new Set(selected.map((product) => product.id)).size, 4);
  assert.deepEqual(selected.map((product) => product.id), [3, 2, 1, 4]);
});

test("product card specifications show existing model, size, rating and pole data only", () => {
  const specifications = getProductCardSpecifications({
    name: "MCB",
    model: "C32",
    size: "6A to 63A",
    specifications: [
      { name: "Model number", value: "C32" },
      { name: "Ampere rating", value: "6A to 63A" },
      { name: "Size", value: "6A to 63A" },
      { name: "Pole configuration", value: "SP / DP / TP" },
    ],
  });

  assert.deepEqual(specifications, [
    { name: "Model", value: "C32" },
    { name: "Size / specification", value: "6A to 63A" },
    { name: "Available pole configurations", value: "SP / DP / TP" },
    { name: "Ampere rating", value: "6A to 63A" },
  ]);
});

test("priority catalogue products are placed before regular homepage products", () => {
  const products = [
    { id: 1, is_active: 1, name: "Other product", brand: "Other", is_featured: 1 },
    { id: 2, is_active: 1, name: "FR Wire", brand: "Polycab", category: "Wires & Cables" },
    { id: 3, is_active: 0, name: "Trivo Switch", brand: "GreatWhite" },
    { id: 4, is_active: 1, name: "DP MCB", brand: "Altech" },
    { id: 5, is_active: 1, name: "Gharghanti", brand: "Guruttech" },
  ];

  assert.deepEqual(selectHomepageProducts(products).map((product) => product.id), [2, 4, 5, 1]);
});

test("cards use the existing SKU when a model number is absent", () => {
  assert.deepEqual(getProductCardSpecifications({
    name: "Fan",
    sku: "FAN-001",
    size: "1200mm",
    specifications: [{ name: "Size", value: "1200mm" }],
  }), [
    { name: "SKU", value: "FAN-001" },
    { name: "Size / specification", value: "1200mm" },
  ]);
});

test("detail specifications include only stored values and omit empty fields", () => {
  assert.deepEqual(getProductDetailSpecifications({
    name: "MCB",
    sku: "MCB-001",
    size: "6A to 63A",
    specifications: [
      { name: "Ampere rating", value: "6A to 63A" },
      { name: "Breaking capacity", value: "" },
    ],
  }), [
    { key: "sku", name: "SKU", value: "MCB-001" },
    { key: "size", name: "Size / specification", value: "6A to 63A" },
    { key: "Ampere rating-0", name: "Ampere rating", value: "6A to 63A" },
  ]);
});

test("catalogue placeholder text is not shown as a size or specification", () => {
  assert.deepEqual(getProductCardSpecifications({
    name: "Smart Switch",
    sku: "JGE-SWITCH-002",
    size: "Ask for available models",
    specifications: [{ name: "Size", value: "Ask for available models" }],
  }), [{ name: "SKU", value: "JGE-SWITCH-002" }]);
});
