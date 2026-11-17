import { BUSINESS } from "./constants.js";

export function getWhatsAppUrl(message, business = BUSINESS) {
  const text = message || `Hello ${business.name}, I would like to know more.`;
  return `https://wa.me/${business.phoneDigits}?text=${encodeURIComponent(text)}`;
}

export function openWhatsApp(message, business = BUSINESS) {
  window.open(getWhatsAppUrl(message, business), "_blank", "noopener,noreferrer");
}
