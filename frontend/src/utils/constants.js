import { BUSINESS_NAME } from "./branding.js";

export const BUSINESS = {
  name: BUSINESS_NAME,
  phone: "+91 99744 91814",
  phoneDigits: "919974491814",
  email: "jaygurudevelectricals@gmail.com",
  address: "Gurutek House Lane, Opposite District Panchayat, Dhundhiyawadi, Palanpur – 385001, Gujarat, India",
  hours: "Monday – Saturday · 8:00 AM – 8:00 PM · Sunday: CLOSED",
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Gurutek House Lane, Opposite District Panchayat, Dhundhiyawadi, Palanpur 385001, Gujarat, India")}`,
  googleReviewVerified: "false",
  googleRating: "",
  googleReviewCount: "",
  googleReviewUrl: "",
  catalogueUrl: "",
};

export const LEGACY_BUSINESS = {
  address: "Opp. Jilla Panchayat, Palanpur, Gujarat",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Opp.+Jilla+Panchayat%2C+Palanpur%2C+Gujarat",
};

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
