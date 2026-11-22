import { BUSINESS_NAME } from "./branding.js";

export const SHOP_MAPS_URL = "https://maps.app.goo.gl/NL2bw3WzfQ1qpomT9?g_st=aw";
export const SHOP_ADDRESS = "Guruttech House, Deep Glass & Hardware wali gali, opp. Jilla Panchayat, Dhundhiyawadi, Palanpur, Gujarat 385001";

export const BUSINESS = {
  name: BUSINESS_NAME,
  phone: "+91 99744 91814",
  phoneDigits: "919974491814",
  email: "jaygurudevelectricals@gmail.com",
  address: SHOP_ADDRESS,
  hours: "Monday – Saturday · 8:00 AM – 8:00 PM · Sunday: CLOSED",
  mapsUrl: SHOP_MAPS_URL,
  googleReviewVerified: "false",
  googleRating: "",
  googleReviewCount: "",
  googleReviewUrl: "",
  catalogueUrl: "",
};

export function isLegacyShopAddress(address) {
  const normalized = String(address || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return !normalized
    || normalized.includes("gurutekhouselane")
    || normalized.startsWith("oppjillapanchayatpalanpur");
}

export function normalizeBusinessHours(hours) {
  const source = String(hours || BUSINESS.hours)
    .trim()
    .replace(/\bEvery day\b|\bDaily\b/gi, "Monday – Saturday")
    .replace(/\bMon(?:day)?\s*(?:-|–|to)\s*Sun(?:day)?\b/gi, "Monday – Saturday")
    .replace(/\b9:00\s*AM\b/gi, "8:00 AM")
    .replace(/\b9:00\s*PM\b/gi, "8:00 PM");
  const weekdays = source
    .replace(/(?:[·,;]\s*)?Sunday\b[^·,;]*/gi, "")
    .replace(/[·,;]\s*$/, "")
    .trim();

  return `${weekdays ? `${weekdays} · ` : ""}Sunday: CLOSED`;
}

export const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "Categories", to: "/categories" },
  { label: "Products", to: "/products" },
  { label: "Brands", to: "/brands" },
  { label: "About", to: "/about" },
  { label: "Gallery", to: "/gallery" },
  { label: "Contact", to: "/contact" },
];
