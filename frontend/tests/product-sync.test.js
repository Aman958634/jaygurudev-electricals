import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getProductCardSpecifications,
  getProductDetailSpecifications,
  selectHomepageProducts,
} from "../src/utils/productPresentation.js";
import { BUSINESS, SHOP_ADDRESS, SHOP_MAPS_URL } from "../src/utils/constants.js";
import { getGoogleMapsAddressSearchUrl } from "../src/utils/maps.js";
import { getProductEnquiryMessage, getRetailEnquiryMessage, getWhatsAppUrl } from "../src/utils/whatsapp.js";
import { getHeroContent } from "../src/utils/pageContent.js";
import { formatBusinessHours, parseBusinessHours, phoneDigits } from "../src/utils/businessSettings.js";

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
  assert.deepEqual(selected.map((product) => product.id), [2, 3, 1, 4]);
});

test("product card specifications show existing model, capacity, size, packing and pole data only", () => {
  const specifications = getProductCardSpecifications({
    name: "MCB",
    model: "C32",
    size: "20 mm",
    specifications: [
      { name: "Model number", value: "C32" },
      { name: "Capacity", value: "32" },
      { name: "Capacity unit", value: "A" },
      { name: "Electrical rating", value: "C curve" },
      { name: "Packing", value: "10 pcs" },
      { name: "Pole configuration", value: "SP / DP / TP" },
    ],
  });

  assert.deepEqual(specifications, [
    { name: "Model", value: "C32" },
    { name: "Capacity", value: "32 A" },
    { name: "Size", value: "20 mm" },
    { name: "Electrical rating", value: "C curve" },
    { name: "Packing", value: "10 pcs" },
    { name: "Available pole configurations", value: "SP / DP / TP" },
  ]);
});

test("explicitly featured catalogue products take precedence over priority fallbacks", () => {
  const products = [
    { id: 1, is_active: 1, name: "Other product", brand: "Other", is_featured: 1 },
    { id: 2, is_active: 1, name: "FR Wire", brand: "Polycab", category: "Wires & Cables" },
    { id: 3, is_active: 0, name: "Trivo Switch", brand: "GreatWhite" },
    { id: 4, is_active: 1, name: "DP MCB", brand: "Altech" },
    { id: 5, is_active: 1, name: "Gharghanti", brand: "Guruttech" },
  ];

  assert.deepEqual(selectHomepageProducts(products).map((product) => product.id), [1, 2, 4, 5]);
});

test("cards do not present an SKU as a model number", () => {
  assert.deepEqual(getProductCardSpecifications({
    name: "Fan",
    sku: "FAN-001",
    size: "1200mm",
    specifications: [{ name: "Size", value: "1200mm" }],
  }), [
    { name: "Size", value: "1200mm" },
  ]);
});

test("detail specifications include only stored values and omit empty fields", () => {
  assert.deepEqual(getProductDetailSpecifications({
    name: "MCB",
    model: "C16",
    size: "6A to 63A",
    specifications: [
      { name: "Capacity", value: "16" },
      { name: "Capacity unit", value: "A" },
      { name: "Breaking capacity", value: "" },
    ],
  }), [
    { key: "model", name: "Model", value: "C16" },
    { key: "capacity", name: "Capacity", value: "16 A" },
    { key: "size", name: "Size", value: "6A to 63A" },
  ]);
});

test("catalogue placeholder text is not shown as a size or specification", () => {
  assert.deepEqual(getProductCardSpecifications({
    name: "Smart Switch",
    sku: "JGE-SWITCH-002",
    size: "Ask for available models",
    specifications: [{ name: "Size", value: "Ask for available models" }],
  }), []);
});

test("refrigerator and washing-machine capacity units are displayed only when stored", () => {
  assert.deepEqual(getProductCardSpecifications({ name: "Refrigerator", capacity: "190", capacity_unit: "L" }), [{ name: "Capacity", value: "190 L" }]);
  assert.deepEqual(getProductCardSpecifications({ name: "Washing Machine", capacity: "7", capacity_unit: "kg" }), [{ name: "Capacity", value: "7 kg" }]);
});

test("product WhatsApp enquiries identify the actual stored model and specifications", () => {
  const message = getProductEnquiryMessage({
    name: "Refrigerator", brand: "Samsung", model: "RT28", capacity: "253", capacity_unit: "L", size: "Double door",
  }, BUSINESS);
  assert.match(message, /Brand: Samsung/);
  assert.match(message, /Model: RT28/);
  assert.match(message, /Capacity: 253 L/);
  assert.doesNotMatch(message, /SKU/);
});

test("retail WhatsApp enquiry uses the configured number and URL-encoded message", () => {
  const message = getRetailEnquiryMessage(BUSINESS);
  const url = new URL(getWhatsAppUrl(message, BUSINESS));

  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, `/${BUSINESS.phoneDigits}`);
  assert.equal(url.searchParams.get("text"), message);
  assert.match(message, /price and availability/i);
});

test("the client-provided Maps listing is the centralized public destination", () => {
  assert.equal(BUSINESS.mapsUrl, SHOP_MAPS_URL);
  assert.equal(SHOP_MAPS_URL, "https://maps.app.goo.gl/NL2bw3WzfQ1qpomT9?g_st=aw");
});

test("the canonical address is exact", () => {
  assert.equal(BUSINESS.address, SHOP_ADDRESS);
  assert.equal(SHOP_ADDRESS, "Guruttech House, Deep Glass & Hardware wali gali, opp. Jilla Panchayat, Dhundhiyawadi, Palanpur, Gujarat 385001");
});

test("Maps fallback is an address search and does not replace the client-provided listing", () => {
  const fallback = new URL(getGoogleMapsAddressSearchUrl(BUSINESS.address));

  assert.equal(fallback.origin, "https://www.google.com");
  assert.equal(fallback.pathname, "/maps/search/");
  assert.equal(fallback.searchParams.get("query"), BUSINESS.address);
  assert.notEqual(fallback.href, SHOP_MAPS_URL);
});

test("Google review defaults remain explicitly unverified", () => {
  assert.equal(BUSINESS.googleReviewVerified, "false");
});

test("approved English, Gujarati and Hindi font families are configured", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
  assert.match(html, /Plus\+Jakarta\+Sans/);
  assert.match(html, /Noto\+Sans\+Gujarati/);
  assert.match(html, /Noto\+Sans\+Devanagari/);
  assert.match(css, /--font-heading: "Plus Jakarta Sans"/);
  assert.match(css, /--font-body: "Inter"/);
  assert.match(css, /html:lang\(gu\)/);
  assert.match(css, /html:lang\(hi\)/);
});

test("page-content admin saves JSON when no upload field is configured", () => {
  const editor = fs.readFileSync(new URL("../src/admin/AdminResource.jsx", import.meta.url), "utf8");
  assert.match(editor, /const hasFileFields = config\.fields\.some/);
  assert.match(editor, /hasFileFields \? payload : JSON\.stringify\(Object\.fromEntries\(payload\.entries\(\)\)\)/);
});

test("hero content preserves the exact saved page title, heading and description", () => {
  const saved = {
    page_title: "SYNC TITLE 20261123",
    heading: "SYNC HEADING 20261123",
    content: "SYNC DESCRIPTION 20261123",
  };
  assert.deepEqual(getHeroContent(saved), {
    title: saved.page_title,
    heading: saved.heading,
    description: saved.content,
  });
  const hero = fs.readFileSync(new URL("../src/components/home/Hero.jsx", import.meta.url), "utf8");
  assert.match(hero, /homePage\.data/);
  assert.match(hero, /getHeroContent\(savedHomePage\)/);
  assert.doesNotMatch(hero, /normalizeBusinessCopy/);
});

test("business-hours settings preserve Sunday closed and format public hours", () => {
  const schedule = parseBusinessHours(JSON.stringify([
    { day: "Monday", open: "08:00", close: "20:00", closed: false },
    { day: "Tuesday", open: "08:00", close: "20:00", closed: false },
    { day: "Wednesday", open: "08:00", close: "20:00", closed: false },
    { day: "Thursday", open: "08:00", close: "20:00", closed: false },
    { day: "Friday", open: "08:00", close: "20:00", closed: false },
    { day: "Saturday", open: "08:00", close: "20:00", closed: false },
    { day: "Sunday", open: "08:00", close: "20:00", closed: true },
  ]));
  assert.match(formatBusinessHours(schedule), /Sunday: CLOSED/);
  const legacySchedule = parseBusinessHours(undefined, "Monday-Saturday: 9:30 AM - 7:15 PM | Sunday: CLOSED");
  assert.equal(legacySchedule[0].open, "09:30");
  assert.equal(legacySchedule[5].close, "19:15");
  assert.equal(legacySchedule[6].closed, true);
  assert.equal(phoneDigits("+91 99744 91814"), "919974491814");
});

test("website settings is a direct, mobile-safe admin destination with all required sections", () => {
  const panel = fs.readFileSync(new URL("../src/admin/AdminPanel.jsx", import.meta.url), "utf8");
  const settings = fs.readFileSync(new URL("../src/admin/AdminWebsiteSettings.jsx", import.meta.url), "utf8");
  assert.match(panel, /\{ id: "settings", label: "Website Settings", icon: Settings \}/);
  assert.match(panel, /activeSection === "settings" && <AdminWebsiteSettings/);
  assert.match(panel, /setMobileNavOpen\(false\)/);
  assert.doesNotMatch(panel, /admin-content-tabs/);
  ["Business information", "Contact details", "Opening hours", "Google Maps & location", "Social media", "Footer information"].forEach((section) => {
    assert.match(settings, new RegExp(section));
  });
});
