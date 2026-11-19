import { BUSINESS_NAME } from "./branding.js";

export const BUSINESS = {
  name: BUSINESS_NAME,
  phone: "+91 99744 91814",
  phoneDigits: "919974491814",
  email: "jaygurudevelectricals@gmail.com",
  address: "Gurutek House Lane, Opposite District Panchayat, Dhundhiyawadi, Palanpur – 385001, Gujarat, India",
  hours: "Every day · 8:00 AM – 8:00 PM",
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Gurutek House Lane, Opposite District Panchayat, Dhundhiyawadi, Palanpur 385001, Gujarat, India")}`,
  googleReviewVerified: "false",
  googleRating: "",
  googleReviewCount: "",
  googleReviewUrl: "",
  catalogueUrl: "",
};

export const LEGACY_BUSINESS = {
  address: "Opp. Jilla Panchayat, Palanpur, Gujarat",
  hours: "Mon – Sun · 9:00 AM – 9:00 PM",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Opp.+Jilla+Panchayat%2C+Palanpur%2C+Gujarat",
};

export const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "Categories", to: "/categories" },
  { label: "Products", to: "/products" },
  { label: "Brands", to: "/brands" },
  { label: "About", to: "/about" },
  { label: "Gallery", to: "/gallery" },
  { label: "Contact", to: "/contact" },
];
